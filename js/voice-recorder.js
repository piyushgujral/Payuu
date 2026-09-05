/* ====================================================
   PAYUU LIVE - VOICE MESSAGE RECORDER
   Records microphone audio, uploads it to R2 through
   /api/upload-voice, and attaches the uploaded URL to
   the Firebase pending-support submission.
   ==================================================== */
(function () {
    'use strict';

    const MAX_SIZE = 4 * 1024 * 1024;
    const MAX_DURATION_SECONDS = 60;

    const state = {
        stream: null,
        recorder: null,
        chunks: [],
        blob: null,
        objectUrl: '',
        voiceUrl: '',
        mimeType: '',
        duration: 0,
        startedAt: 0,
        timer: null,
        uploading: false,
        firebaseConnected: false
    };

    window.PayuuVoice = {
        getState: () => ({
            voiceUrl: state.voiceUrl,
            voiceMimeType: state.mimeType,
            voiceDuration: state.duration,
            voiceStatus: state.voiceUrl ? 'uploaded' : 'none',
            voiceEnabled: !!state.voiceUrl,
            uploading: state.uploading,
            hasRecording: !!state.blob,
            firebaseConnected: state.firebaseConnected
        }),
        clear: clearRecording
    };

    function $(id) {
        return document.getElementById(id);
    }

    function setStatus(message, isError) {
        const el = $('voice-upload-status');
        if (!el) return;
        el.textContent = message || '';
        el.style.color = isError ? '#ff6b6b' : '#9fffb0';
    }

    function setButtonVisible(id, visible) {
        const el = $(id);
        if (el) el.style.display = visible ? '' : 'none';
    }

    function stopStream() {
        if (state.stream) {
            state.stream.getTracks().forEach(track => track.stop());
            state.stream = null;
        }
    }

    function stopTimer() {
        if (state.timer) {
            clearInterval(state.timer);
            state.timer = null;
        }
    }

    function updateTimer() {
        const elapsed = Math.min(
            MAX_DURATION_SECONDS,
            Math.floor((Date.now() - state.startedAt) / 1000)
        );
        state.duration = elapsed;
        const el = $('voice-recording-time');
        if (el) {
            const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const seconds = String(elapsed % 60).padStart(2, '0');
            el.textContent = `${minutes}:${seconds}`;
        }
        if (elapsed >= MAX_DURATION_SECONDS && state.recorder && state.recorder.state === 'recording') {
            state.recorder.stop();
        }
    }

    function checkFirebaseConnection() {
        try {
            if (!window.firebase || !window.firebase.database) {
                state.firebaseConnected = false;
                console.error('Payuu Firebase: SDK/database library is not loaded.');
                return;
            }

            const connectedRef = firebase.database().ref('.info/connected');
            connectedRef.on('value', snapshot => {
                state.firebaseConnected = snapshot.val() === true;
                console.log('Payuu Firebase Realtime Database:', state.firebaseConnected ? 'CONNECTED' : 'DISCONNECTED');
            });
        } catch (error) {
            state.firebaseConnected = false;
            console.error('Payuu Firebase connection check failed:', error);
        }
    }

    function pickMimeType() {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/ogg',
            'audio/mp4'
        ];
        if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
        return types.find(type => MediaRecorder.isTypeSupported(type)) || '';
    }

    async function startRecording() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setStatus('Microphone recording is not supported in this browser.', true);
            return;
        }
        if (!window.MediaRecorder) {
            setStatus('Voice recording is not supported in this browser.', true);
            return;
        }

        clearRecording(false);

        try {
            state.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            const mimeType = pickMimeType();
            state.mimeType = mimeType || 'audio/webm';
            state.chunks = [];
            state.blob = null;
            state.voiceUrl = '';
            state.duration = 0;

            state.recorder = mimeType
                ? new MediaRecorder(state.stream, { mimeType })
                : new MediaRecorder(state.stream);

            state.recorder.addEventListener('dataavailable', event => {
                if (event.data && event.data.size > 0) state.chunks.push(event.data);
            });

            state.recorder.addEventListener('error', event => {
                console.error('Voice recorder error:', event.error || event);
                stopTimer();
                stopStream();
                setStatus('Recording failed. Please try again.', true);
                state.recorder = null;
            });

            state.recorder.addEventListener('stop', finishRecording, { once: true });

            state.startedAt = Date.now();
            state.recorder.start(250);
            state.timer = setInterval(updateTimer, 250);

            const panel = $('voice-recorder-panel');
            if (panel) panel.style.display = '';
            setButtonVisible('voice-stop-btn', true);
            setButtonVisible('voice-play-btn', false);
            setButtonVisible('voice-rerecord-btn', false);
            setButtonVisible('voice-delete-btn', false);
            setStatus('Recording… maximum 60 seconds.');

            const recordBtn = $('voice-record-btn');
            if (recordBtn) recordBtn.textContent = '🔴 RECORDING…';
        } catch (error) {
            console.error('Microphone permission error:', error);
            stopStream();
            setStatus(
                error && error.name === 'NotAllowedError'
                    ? 'Microphone permission was denied. Allow microphone access and try again.'
                    : 'Could not access the microphone. Please try again.',
                true
            );
        }
    }

    function finishRecording() {
        stopTimer();
        stopStream();

        const type = state.mimeType || 'audio/webm';
        state.blob = new Blob(state.chunks, { type });
        state.chunks = [];
        state.recorder = null;

        const recordBtn = $('voice-record-btn');
        if (recordBtn) recordBtn.textContent = '🎙️ SPEAK MESSAGE';
        setButtonVisible('voice-stop-btn', false);
        setButtonVisible('voice-play-btn', true);
        setButtonVisible('voice-rerecord-btn', true);
        setButtonVisible('voice-delete-btn', true);

        if (!state.blob.size) {
            setStatus('No audio was captured. Please re-record.', true);
            return;
        }

        if (state.blob.size > MAX_SIZE) {
            setStatus('Voice recording is too large. Please keep it shorter than 60 seconds.', true);
            return;
        }

        if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
        state.objectUrl = URL.createObjectURL(state.blob);
        const preview = $('voice-preview');
        if (preview) {
            preview.src = state.objectUrl;
            preview.style.display = '';
        }

        uploadRecording();
    }

    async function uploadRecording() {
        if (!state.blob) return;

        state.uploading = true;
        state.voiceUrl = '';
        setStatus('Uploading voice message…');

        try {
            const type = state.mimeType || state.blob.type || 'audio/webm';
            const response = await fetch('/api/upload-voice', {
                method: 'POST',
                headers: { 'Content-Type': type },
                body: state.blob
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.voiceUrl) {
                throw new Error(data.error || `Upload failed (${response.status})`);
            }

            state.voiceUrl = data.voiceUrl;
            state.uploading = false;
            setStatus('✓ Voice uploaded. Payment is ready.');
        } catch (error) {
            state.uploading = false;
            state.voiceUrl = '';
            console.error('Voice upload failed:', error);
            setStatus(
                `Voice upload failed: ${error && error.message ? error.message : 'Please re-record and try again.'}`,
                true
            );
        }
    }

    function clearRecording(showStatus = true) {
        stopTimer();
        stopStream();
        if (state.objectUrl) {
            URL.revokeObjectURL(state.objectUrl);
            state.objectUrl = '';
        }
        state.recorder = null;
        state.chunks = [];
        state.blob = null;
        state.voiceUrl = '';
        state.mimeType = '';
        state.duration = 0;
        state.startedAt = 0;
        state.uploading = false;

        const preview = $('voice-preview');
        if (preview) {
            preview.pause();
            preview.removeAttribute('src');
            preview.load();
            preview.style.display = 'none';
        }

        const time = $('voice-recording-time');
        if (time) time.textContent = '00:00';
        const recordBtn = $('voice-record-btn');
        if (recordBtn) recordBtn.textContent = '🎙️ SPEAK MESSAGE';

        setButtonVisible('voice-stop-btn', false);
        setButtonVisible('voice-play-btn', false);
        setButtonVisible('voice-rerecord-btn', false);
        setButtonVisible('voice-delete-btn', false);
        if (showStatus) setStatus('');
    }

    function patchPendingSupport() {
        if (!window.firebaseDB || typeof window.firebaseDB.addPendingSupport !== 'function') return;
        if (window.firebaseDB.__payuuVoicePatched) return;

        const original = window.firebaseDB.addPendingSupport.bind(window.firebaseDB);
        window.firebaseDB.addPendingSupport = function (data) {
            const voice = window.PayuuVoice.getState();
            if (voice.voiceUrl) {
                data = {
                    ...data,
                    voiceUrl: voice.voiceUrl,
                    voiceMimeType: voice.voiceMimeType,
                    voiceDuration: voice.voiceDuration,
                    voiceStatus: voice.voiceStatus,
                    voiceEnabled: true,
                    messageSource: 'voice'
                };
            }
            return original(data);
        };
        window.firebaseDB.__payuuVoicePatched = true;
    }

    function attach() {
        const recordBtn = $('voice-record-btn');
        const stopBtn = $('voice-stop-btn');
        const playBtn = $('voice-play-btn');
        const rerecordBtn = $('voice-rerecord-btn');
        const deleteBtn = $('voice-delete-btn');
        const form = $('tip-form');

        checkFirebaseConnection();

        if (!recordBtn || !form) return;

        patchPendingSupport();

        recordBtn.addEventListener('click', () => {
            if (state.recorder && state.recorder.state === 'recording') return;
            startRecording();
        });

        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                if (state.recorder && state.recorder.state === 'recording') state.recorder.stop();
            });
        }

        if (playBtn) {
            playBtn.addEventListener('click', () => {
                const preview = $('voice-preview');
                if (preview) preview.play().catch(() => {});
            });
        }

        if (rerecordBtn) {
            rerecordBtn.addEventListener('click', () => {
                clearRecording();
                startRecording();
            });
        }

        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => clearRecording());
        }

        form.addEventListener('submit', event => {
            if (!state.blob && !state.uploading && !state.voiceUrl) return;

            if (state.uploading) {
                event.preventDefault();
                event.stopImmediatePropagation();
                setStatus('Please wait for the voice message to finish uploading.', true);
                return;
            }

            if (state.blob && !state.voiceUrl) {
                event.preventDefault();
                event.stopImmediatePropagation();
                setStatus('Voice upload failed. Please re-record and try again.', true);
                return;
            }
        }, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attach);
    } else {
        attach();
    }
})();
