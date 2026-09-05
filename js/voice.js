/* ====================================================
   PAYUU LIVE DASHBOARD - PLUGGABLE VOICE MANAGER
   ==================================================== */

class VoiceManager {
    constructor() {
        this.queue = [];
        this.isSpeaking = false;
        this.synth = window.speechSynthesis || null;

        if (this.synth && this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = () => { this.getAvailableVoices(); };
        }
    }

    getAvailableVoices() {
        return this.synth ? this.synth.getVoices() : [];
    }

    constructSpeechLines(template, item, settings) {
        const dateStr = item.dateSubmitted || (item.approvedAt ? new Date(item.approvedAt).toLocaleDateString() : new Date().toLocaleDateString());
        const timeStr = item.timeSubmitted || (item.approvedAt ? new Date(item.approvedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString());
        const supporterMsg = item.msg ? item.msg.trim() : "";

        let lines = template.split('\n');
        let processedLines = [];

        lines.forEach(line => {
            if (line.includes('{Message}') && !supporterMsg) {
                return;
            }

            let l = line
                .replace(/\{SupporterName\}/g, item.name || "A Supporter")
                .replace(/\{Amount\}/g, item.amount || 0)
                .replace(/\{Message\}/g, supporterMsg)
                .replace(/\{Currency\}/g, settings.currencySymbol || "₹")
                .replace(/\{StreamerName\}/g, settings.streamerName || "Payuu Live")
                .replace(/\{WebsiteName\}/g, settings.websiteName || "Payuu Live")
                .replace(/\{Date\}/g, dateStr)
                .replace(/\{Time\}/g, timeStr);

            if (l.trim().length > 0) {
                processedLines.push(l.trim());
            }
        });

        return processedLines;
    }

    speak(item, settings, onComplete) {
        const vCfg = settings.voice || {};
        if (!this.synth || vCfg.enabled === false) {
            if (onComplete) onComplete();
            return;
        }

        const scriptTemplate = vCfg.script && vCfg.script.trim().length > 0 ? vCfg.script : "🔥 New Support Received!\n\n{SupporterName} has supported the stream.\n\nAmount: {Currency}{Amount}.\n\n{Message}\n\nThank you for supporting {WebsiteName}.";
        const lines = this.constructSpeechLines(scriptTemplate, item, settings);

        if (lines.length === 0) {
            if (onComplete) onComplete();
            return;
        }

        this.queue.push({ lines, vCfg, onComplete });
        this.processQueue();
    }

    processQueue() {
        if (this.isSpeaking || this.queue.length === 0) return;

        this.isSpeaking = true;
        const current = this.queue.shift();

        this.synth.cancel();

        const pauseMs = Number(current.vCfg.pauseMs) !== undefined ? Number(current.vCfg.pauseMs) : 500;
        let lineIdx = 0;

        const speakNextLine = () => {
            if (lineIdx >= current.lines.length) {
                this.isSpeaking = false;
                if (current.onComplete) current.onComplete();
                this.processQueue();
                return;
            }

            const currentText = current.lines[lineIdx];
            const utterance = new SpeechSynthesisUtterance(currentText);

            const lang = current.vCfg.language === "mixed" ? "en-IN" : (current.vCfg.language || "en-IN");
            utterance.lang = lang;
            utterance.volume = (current.vCfg.volumePct !== undefined ? current.vCfg.volumePct : 90) / 100;
            utterance.rate = Number(current.vCfg.rate) || 1.0;

            if (current.vCfg.gender === "male") {
                utterance.pitch = Number(current.vCfg.pitch) ? Number(current.vCfg.pitch) * 0.7 : 0.8;
            } else {
                utterance.pitch = Number(current.vCfg.pitch) || 1.2;
            }

            const voices = this.getAvailableVoices();
            const matched = voices.find(v => v.lang === lang || v.lang.replace('_', '-').startsWith(lang.split('-')[0]));
            if (matched) utterance.voice = matched;

            utterance.onend = () => {
                lineIdx++;
                setTimeout(speakNextLine, pauseMs);
            };

            utterance.onerror = () => {
                lineIdx++;
                setTimeout(speakNextLine, pauseMs);
            };

            this.synth.speak(utterance);
        };

        speakNextLine();
    }

    stop() {
        if (this.synth) {
            this.synth.cancel();
            this.isSpeaking = false;
            this.queue = [];
        }
    }
}

window.voiceManagerEngine = new VoiceManager();