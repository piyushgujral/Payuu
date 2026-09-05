/* ====================================================
   PAYUU LIVE DASHBOARD - FIREBASE REALTIME DB & AUTH MODULE
   ==================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyDrZoqvp4UQ2KP1a3sYqniQg-SFodC24K0",
  authDomain: "payuulive.firebaseapp.com",
  databaseURL: "https://payuulive-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "payuulive",
  storageBucket: "payuulive.firebasestorage.app",
  messagingSenderId: "261040331266",
  appId: "1:261040331266:web:f4adaa25d4512ff5e9251b"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const auth = firebase.auth();
const storage = firebase.storage();
const googleProvider = new firebase.auth.GoogleAuthProvider();

window.firebaseDB = {

  /* ====================================================
     AUTH
     ==================================================== */

  signInWithGoogle: function() {
    return auth.signInWithPopup(googleProvider);
  },

  signOut: function() {
    return auth.signOut();
  },

  onAuthStateChanged: function(callback) {
    auth.onAuthStateChanged(callback);
  },

  /* ====================================================
     ADMIN
     ==================================================== */

  checkAdminStatus: function(userEmail, callback) {
    db.ref("admins").once("value", (snapshot) => {

      const admins = snapshot.val() || {};
      let matchedAdmin = null;

      Object.keys(admins).forEach(uid => {

        if (
          admins[uid].email &&
          admins[uid].email.toLowerCase() ===
            userEmail.toLowerCase()
        ) {

          matchedAdmin = {
            uid,
            ...admins[uid]
          };
        }

      });

      callback(matchedAdmin);
    });
  },

  listenAdmins: function(callback) {

    db.ref("admins").on("value", (snapshot) => {

      const data = snapshot.val();

      callback(
        data
          ? Object.keys(data).map(key => ({
              ...data[key],
              _key: key
            }))
          : []
      );

    });

  },

  getActiveAdminEmails: function(callback) {

    db.ref("admins").once("value", (snapshot) => {

      const data = snapshot.val() || {};
      const activeEmails = [];

      Object.keys(data).forEach(key => {

        if (
          data[key].active === true &&
          data[key].email
        ) {

          activeEmails.push(data[key].email);

        }

      });

      callback(activeEmails);

    });

  },

  saveAdmin: function(adminData) {

    const sanitizeEmailKey =
      adminData.email.replace(/[@.]/g, "_");

    return db.ref(
      "admins/" + sanitizeEmailKey
    ).set({

      email: adminData.email.toLowerCase(),

      role:
        adminData.role ||
        "moderator",

      active:
        adminData.active !== undefined
          ? adminData.active
          : true,

      updatedAt:
        firebase.database.ServerValue.TIMESTAMP

    });

  },

  toggleAdminActive: function(key, activeState) {

    return db.ref(
      "admins/" + key
    ).update({
      active: activeState
    });

  },

  deleteAdmin: function(key) {

    return db.ref(
      "admins/" + key
    ).remove();

  },

  /* ====================================================
     AUDIT LOGS
     ==================================================== */

  logAuditAction: function(auditData) {

    const newRef =
      db.ref("auditLogs").push();

    return newRef.set({

      id: newRef.key,

      adminEmail:
        auditData.adminEmail ||
        "System",

      action:
        auditData.action ||
        "UNKNOWN",

      supporterName:
        auditData.supporterName ||
        "N/A",

      amount:
        auditData.amount ||
        0,

      details:
        auditData.details ||
        "",

      timestamp:
        firebase.database.ServerValue.TIMESTAMP

    });

  },

  listenAuditLogs: function(callback) {

    db.ref("auditLogs")
      .limitToLast(50)
      .on("value", (snapshot) => {

        const data =
          snapshot.val();

        callback(
          data
            ? Object.keys(data)
                .map(key => ({
                  ...data[key],
                  _key: key
                }))
                .reverse()
            : []
        );

      });

  },

  /* ====================================================
     NOTIFICATION LOGS
     ==================================================== */

  logNotificationAttempt: function(logData) {

    const newRef =
      db.ref("notificationLogs").push();

    return newRef.set({

      id: newRef.key,

      recipient:
        logData.recipient ||
        "N/A",

      supporterName:
        logData.supporterName ||
        "N/A",

      amount:
        logData.amount ||
        0,

      status:
        logData.status ||
        "UNKNOWN",

      error:
        logData.error ||
        null,

      timestamp:
        firebase.database.ServerValue.TIMESTAMP

    });

  },

  listenNotificationLogs: function(callback) {

    db.ref("notificationLogs")
      .limitToLast(25)
      .on("value", (snapshot) => {

        const data =
          snapshot.val();

        callback(
          data
            ? Object.keys(data)
                .map(key => ({
                  ...data[key],
                  _key: key
                }))
                .reverse()
            : []
        );

      });

  },

  /* ====================================================
     R2 VOICE UPLOAD
     ==================================================== */

  uploadVoiceRecording:
    function(blob, fileName, contentType) {

      if (!blob) {

        return Promise.reject(
          new Error(
            "No voice recording supplied."
          )
        );

      }

      const type =
        contentType ||
        blob.type ||
        "audio/webm";

      if (
        !type
          .toLowerCase()
          .startsWith("audio/")
      ) {

        return Promise.reject(
          new Error(
            "Only audio files are allowed."
          )
        );

      }

      if (
        blob.size >
        5 * 1024 * 1024
      ) {

        return Promise.reject(
          new Error(
            "Voice recording exceeds the 5 MB limit."
          )
        );

      }

      return fetch(
        "/api/upload-voice",
        {
          method: "POST",

          headers: {
            "Content-Type": type
          },

          body: blob
        }
      )
      .then(async response => {

        const data =
          await response
            .json()
            .catch(() => ({}));

        if (
          !response.ok ||
          !data.voiceUrl
        ) {

          throw new Error(
            data.error ||
            "Voice upload failed."
          );

        }

        return data.voiceUrl;

      });

    },

  /* ====================================================
     SUPPORT SUBMISSION
     ==================================================== */

  addPendingSupport:
    function(data) {

      const newRef =
        db.ref("pendingSupport").push();

      return newRef.set({

        id:
          newRef.key,

        name:
          data.name,

        amount:
          Number(data.amount),

        msg:
          data.msg || "",

        messageSource:
          data.messageSource ||
          "text",

        voiceUrl:
          data.voiceUrl ||
          "",

        voiceMimeType:
          data.voiceMimeType ||
          "",

        voiceDuration:
          Number(
            data.voiceDuration ||
            0
          ),

        voiceStatus:
          data.voiceStatus ||
          "none",

        voiceEnabled:
          data.voiceEnabled === true,

        status:
          data.status ||
          "Awaiting Verification",

        timeSubmitted:
          data.timeSubmitted ||
          new Date().toLocaleTimeString(
            [],
            {
              hour: "2-digit",
              minute: "2-digit"
            }
          ),

        timestamp:
          firebase.database.ServerValue.TIMESTAMP

      }).then(() => newRef.key);

    },

  /* ====================================================
     APPROVE SUPPORT
     ==================================================== */

  approveSupport:
    function(key, data) {

      const approvedRef =
        db.ref("approvedSupport").push();

      const updateData = {

        id:
          approvedRef.key,

        name:
          data.name,

        amount:
          Number(data.amount),

        msg:
          data.msg || "",

        messageSource:
          data.messageSource ||
          "text",

        voiceUrl:
          data.voiceUrl ||
          "",

        voiceMimeType:
          data.voiceMimeType ||
          "",

        voiceDuration:
          Number(
            data.voiceDuration ||
            0
          ),

        voiceStatus:
          data.voiceUrl
            ? "approved"
            : (
                data.voiceStatus ||
                "none"
              ),

        voiceEnabled:
          data.voiceEnabled === true,

        status:
          "Approved",

        approvedAt:
          firebase.database.ServerValue.TIMESTAMP,

        pinned:
          false

      };

      return approvedRef
        .set(updateData)
        .then(() =>
          db
            .ref(
              "pendingSupport/" +
              key
            )
            .remove()
            .then(() =>
              approvedRef.key
            )
        );

    },

  /* ====================================================
     UPDATE APPROVED SUPPORT
     ==================================================== */

  updateApprovedSupportDetail:
    function(key, updatedData) {

      return db
        .ref(
          "approvedSupport/" +
          key
        )
        .update({

          name:
            updatedData.name,

          amount:
            Number(
              updatedData.amount
            ),

          msg:
            updatedData.msg ||
            "",

          timeSubmitted:
            updatedData.timeSubmitted ||
            "",

          dateSubmitted:
            updatedData.dateSubmitted ||
            "",

          editedAt:
            firebase.database.ServerValue.TIMESTAMP

        });

    },

  /* ====================================================
     DUPLICATE SUPPORT
     ==================================================== */

  duplicateSupport:
    function(data) {

      const approvedRef =
        db.ref("approvedSupport").push();

      const duplicatePayload = {

        id:
          approvedRef.key,

        name:
          data.name +
          " (Copy)",

        amount:
          Number(data.amount),

        msg:
          data.msg || "",

        messageSource:
          data.messageSource ||
          "text",

        voiceUrl:
          data.voiceUrl ||
          "",

        voiceMimeType:
          data.voiceMimeType ||
          "",

        voiceDuration:
          Number(
            data.voiceDuration ||
            0
          ),

        voiceStatus:
          data.voiceUrl
            ? "approved"
            : (
                data.voiceStatus ||
                "none"
              ),

        voiceEnabled:
          data.voiceEnabled === true,

        status:
          "Approved",

        approvedAt:
          firebase.database.ServerValue.TIMESTAMP,

        pinned:
          false

      };

      return approvedRef
        .set(duplicatePayload)
        .then(() => {

          this.pushOverlayAlert(
            duplicatePayload,
            approvedRef.key
          );

          return approvedRef.key;

        });

    },

  /* ====================================================
     PIN SUPPORTER
     ==================================================== */

  pinSupporter:
    function(keyToPin) {

      return db
        .ref("approvedSupport")
        .once("value")
        .then(snapshot => {

          const data =
            snapshot.val() ||
            {};

          const updates = {};

          Object.keys(data)
            .forEach(k => {

              updates[
                "approvedSupport/" +
                k +
                "/pinned"
              ] =
                k === keyToPin;

            });

          return db
            .ref()
            .update(updates);

        });

    },

  unpinSupporter:
    function(key) {

      return db
        .ref(
          "approvedSupport/" +
          key
        )
        .update({
          pinned: false
        });

    },

  deleteApprovedSupport:
    function(key) {

      return db
        .ref(
          "approvedSupport/" +
          key
        )
        .remove();

    },

  rejectSupport:
    function(key) {

      return db
        .ref(
          "pendingSupport/" +
          key
        )
        .update({
          status: "Rejected"
        })
        .then(() =>
          db
            .ref(
              "pendingSupport/" +
              key
            )
            .remove()
        );

    },

  /* ====================================================
     OVERLAY QUEUE
     ==================================================== */

  pushOverlayAlert:
    function(data, approvedKey) {

      const overlayRef =
        db.ref("overlayQueue").push();

      return overlayRef.set({

        id:
          overlayRef.key,

        approvedKey:
          approvedKey || "",

        name:
          data.name,

        amount:
          Number(data.amount),

        msg:
          data.msg || "",

        messageSource:
          data.messageSource ||
          "text",

        voiceUrl:
          data.voiceUrl ||
          "",

        voiceMimeType:
          data.voiceMimeType ||
          "",

        voiceDuration:
          Number(
            data.voiceDuration ||
            0
          ),

        voiceStatus:
          data.voiceStatus ||
          (
            data.voiceUrl
              ? "approved"
              : "none"
          ),

        voiceEnabled:
          data.voiceEnabled === true,

        timestamp:
          firebase.database.ServerValue.TIMESTAMP

      });

    },

  claimOverlayAlert:
    function(key, clientId) {

      if (!key) {
        return Promise.resolve(false);
      }

      const ref = db.ref("overlayQueue/" + key);
      const now = Date.now();

      return ref.transaction(current => {

        if (!current) {
          return;
        }

        const claimedAt =
          Number(current.claimedAt || 0);

        const claimIsStale =
          claimedAt > 0 &&
          (now - claimedAt) > 90000;

        if (
          current.claimedBy &&
          !claimIsStale
        ) {
          return;
        }

        return {
          ...current,
          claimedBy: clientId || "overlay",
          claimedAt: now
        };

      }).then(result => {
        return !!result.committed;
      });

    },

  removeOverlayAlert:
    function(key) {

      return db
        .ref(
          "overlayQueue/" +
          key
        )
        .remove();

    },

  /* ====================================================
     LISTENERS
     ==================================================== */

  listenPending:
    function(callback) {

      db.ref("pendingSupport")
        .on("value", snapshot => {

          const data =
            snapshot.val();

          callback(
            data
              ? Object.keys(data)
                  .map(key => ({
                    ...data[key],
                    _key: key
                  }))
                  .reverse()
              : []
          );

        });

    },

  listenApproved:
    function(callback) {

      db.ref("approvedSupport")
        .on("value", snapshot => {

          const data =
            snapshot.val();

          callback(
            data
              ? Object.keys(data)
                  .map(key => ({
                    ...data[key],
                    _key: key
                  }))
              : []
          );

        });

    },

  listenOverlay:
    function(callback) {

      db.ref("overlayQueue")
        .on("child_added", snapshot => {

          callback(
            snapshot.val(),
            snapshot.key
          );

        });

    },

  listenSettings:
    function(callback) {

      db.ref("settings")
        .on("value", snapshot => {

          callback(
            snapshot.val()
          );

        });

    },

  saveSettings:
    function(settingsObj) {

      return db
        .ref("settings")
        .update(settingsObj);

    },

  resetSettings:
    function(defaultSettings) {

      return db
        .ref("settings")
        .set(defaultSettings);

    },

  resetStatistics:
    function() {

      return Promise.all([

        db
          .ref("approvedSupport")
          .remove(),

        db
          .ref("overlayQueue")
          .remove()

      ]);

    }

};


/* ====================================================
   ORIGINAL SUPPORTER VOICE SYSTEM
   ==================================================== */

(function installOriginalSupporterVoiceSystem() {

  let voiceBlob = null;

  let voiceMimeType = "";

  let voiceDuration = 0;

  let voiceRecorder = null;

  let voiceChunks = [];

  let voiceStartedAt = 0;

  let voiceStopTimer = null;

  let voicePreviewUrl = "";

  // R2 upload state. The payment flow is locked until this is complete.
  let voiceUploadPromise = null;
  let voiceUploadUrl = "";
  let voiceUploadFailed = false;
  let voiceUploadGeneration = 0;


  const setText =
    (id, text) => {

      const el =
        document.getElementById(id);

      if (el) {
        el.textContent = text;
      }

    };


  const setUploadStatus = (text, state = "") => {
    const el =
      document.getElementById("voice-upload-status");

    if (!el) return;

    el.textContent = text;
    el.className = state
      ? `voice-upload-status ${state}`
      : "voice-upload-status";
  };


  const show =
    (id, yes) => {

      const el =
        document.getElementById(id);

      if (el) {

        el.style.display =
          yes
            ? "inline-block"
            : "none";

      }

    };


  function setPaymentLocked(locked) {
    const btn = document.getElementById("support-submit-btn");
    if (!btn) return;

    btn.disabled = !!locked;
    btn.dataset.voiceLocked = locked ? "true" : "false";

    if (locked) {
      btn.setAttribute("aria-disabled", "true");
    } else {
      btn.removeAttribute("aria-disabled");
    }
  }


  function uploadVoiceImmediately() {
    if (!voiceBlob || !window.firebaseDB?.uploadVoiceRecording) {
      return Promise.reject(new Error("Voice upload is unavailable."));
    }

    const mime =
      voiceMimeType ||
      voiceBlob.type ||
      "audio/webm";

    const ext =
      mime.includes("mp4") ? "m4a" :
      mime.includes("ogg") ? "ogg" :
      "webm";

    const fileName =
      `supporter-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;

    const uploadGeneration =
      ++voiceUploadGeneration;

    voiceUploadFailed = false;
    setPaymentLocked(true);
    setUploadStatus(
      "Uploading original voice…",
      "uploading"
    );

    voiceUploadPromise =
      window.firebaseDB.uploadVoiceRecording(
        voiceBlob,
        fileName,
        mime
      )
      .then(url => {
        if (uploadGeneration !== voiceUploadGeneration) {
          return url;
        }

        voiceUploadUrl = url;
        voiceUploadFailed = false;

        setUploadStatus(
          "Voice uploaded successfully. Payment unlocked.",
          "success"
        );

        setPaymentLocked(false);
        return url;
      })
      .catch(error => {
        if (uploadGeneration !== voiceUploadGeneration) {
          throw error;
        }

        voiceUploadUrl = "";
        voiceUploadFailed = true;

        setUploadStatus(
          "Voice upload failed. Payment is locked. Please re-record and try again.",
          "error"
        );

        setPaymentLocked(true);
        throw error;
      });

    return voiceUploadPromise;
  }


  /* ====================================================
     RESET VOICE
     ==================================================== */

  function resetVoice() {

    if (voiceStopTimer) {
      clearTimeout(
        voiceStopTimer
      );
    }

    if (
      voiceRecorder &&
      voiceRecorder.state ===
        "recording"
    ) {

      voiceRecorder.stop();

    }

    voiceRecorder = null;

    voiceBlob = null;

    voiceMimeType = "";

    voiceDuration = 0;

    voiceChunks = [];


    if (voicePreviewUrl) {

      URL.revokeObjectURL(
        voicePreviewUrl
      );

      voicePreviewUrl = "";

    }

    voiceUploadGeneration++;
    voiceUploadPromise = null;
    voiceUploadUrl = "";
    voiceUploadFailed = false;


    const preview =
      document.getElementById(
        "voice-preview"
      );

    if (preview) {

      preview.pause();

      preview.removeAttribute(
        "src"
      );

      preview.load();

      preview.style.display =
        "none";

    }


    [
      "voice-stop-btn",
      "voice-play-btn",
      "voice-rerecord-btn",
      "voice-delete-btn"
    ].forEach(id =>
      show(id, false)
    );


    const panel =
      document.getElementById(
        "voice-recorder-panel"
      );

    if (panel) {

      panel.style.display =
        "none";

    }


    setUploadStatus("", "");

    setText(
      "voice-recording-time",
      "00:00"
    );


    const recBtn =
      document.getElementById(
        "voice-record-btn"
      );

    if (recBtn) {
      recBtn.disabled = false;
    }

  }


  /* ====================================================
     START VOICE RECORDING
     ==================================================== */

  function startVoice() {

    if (
      !navigator.mediaDevices?.getUserMedia ||
      !window.MediaRecorder
    ) {

      alert(
        "Voice recording is not supported in this browser."
      );

      return;

    }


    navigator.mediaDevices
      .getUserMedia({
        audio: true
      })
      .then(stream => {

        setPaymentLocked(true);
        voiceChunks = [];


        const choices = [

          "audio/webm;codecs=opus",

          "audio/webm",

          "audio/mp4"

        ];


        const mime =
          choices.find(type =>
            MediaRecorder.isTypeSupported(
              type
            )
          ) || "";


        voiceRecorder =
          new MediaRecorder(
            stream,
            mime
              ? {
                  mimeType: mime
                }
              : undefined
          );


        voiceMimeType =
          voiceRecorder.mimeType ||
          mime ||
          "audio/webm";


        voiceStartedAt =
          Date.now();


        const panel =
          document.getElementById(
            "voice-recorder-panel"
          );

        if (panel) {

          panel.style.display =
            "block";

        }


        const recBtn =
          document.getElementById(
            "voice-record-btn"
          );

        if (recBtn) {

          recBtn.disabled =
            true;

        }


        show(
          "voice-stop-btn",
          true
        );

        show(
          "voice-play-btn",
          false
        );

        show(
          "voice-rerecord-btn",
          false
        );

        show(
          "voice-delete-btn",
          false
        );


        setText(
          "voice-recording-status",
          "🔴 Recording… maximum 30 seconds."
        );


        voiceRecorder.ondataavailable =
          e => {

            if (
              e.data?.size
            ) {

              voiceChunks.push(
                e.data
              );

            }

          };


        voiceRecorder.onstop =
          () => {

            stream
              .getTracks()
              .forEach(track =>
                track.stop()
              );


            if (voiceStopTimer) {

              clearTimeout(
                voiceStopTimer
              );

            }


            voiceDuration =
              Math.min(
                30,
                Math.max(
                  1,
                  Math.round(
                    (
                      Date.now() -
                      voiceStartedAt
                    ) / 1000
                  )
                )
              );


            voiceBlob =
              new Blob(
                voiceChunks,
                {
                  type:
                    voiceMimeType
                }
              );


            voicePreviewUrl =
              URL.createObjectURL(
                voiceBlob
              );


            const preview =
              document.getElementById(
                "voice-preview"
              );


            if (preview) {

              preview.src =
                voicePreviewUrl;

              preview.style.display =
                "block";

            }


            show(
              "voice-stop-btn",
              false
            );

            show(
              "voice-play-btn",
              true
            );

            show(
              "voice-rerecord-btn",
              true
            );

            show(
              "voice-delete-btn",
              true
            );


            if (recBtn) {
              recBtn.disabled =
                false;
            }


            setText(
              "voice-recording-status",
              `Original voice recorded (${voiceDuration}s).`
            );


            setText(
              "voice-recording-time",
              `00:${String(
                voiceDuration
              ).padStart(2, "0")}`
            );

            // Upload to Cloudflare R2 immediately after recording stops.
            uploadVoiceImmediately().catch(error => {
              console.error(
                "Immediate voice upload failed:",
                error
              );
            });

          };


        voiceRecorder.start(
          250
        );


        voiceStopTimer =
          setTimeout(
            () => {

              if (
                voiceRecorder?.state ===
                "recording"
              ) {

                voiceRecorder.stop();

              }

            },
            30000
          );

      })
      .catch(err => {

        console.error(
          "Microphone error:",
          err
        );

        setPaymentLocked(false);

        alert(
          "Microphone permission is required to record your voice."
        );

      });

  }


  /* ====================================================
     DOM READY
     ==================================================== */

  document.addEventListener(
    "DOMContentLoaded",
    () => {

      const recordBtn =
        document.getElementById(
          "voice-record-btn"
        );

      const stopBtn =
        document.getElementById(
          "voice-stop-btn"
        );

      const playBtn =
        document.getElementById(
          "voice-play-btn"
        );

      const rerecordBtn =
        document.getElementById(
          "voice-rerecord-btn"
        );

      const deleteBtn =
        document.getElementById(
          "voice-delete-btn"
        );


      if (recordBtn) {

        recordBtn.addEventListener(
          "click",
          startVoice
        );

      }


      if (stopBtn) {

        stopBtn.addEventListener(
          "click",
          () => {

            if (
              voiceRecorder?.state ===
              "recording"
            ) {

              voiceRecorder.stop();

            }

          }
        );

      }


      if (playBtn) {

        playBtn.addEventListener(
          "click",
          () => {

            document
              .getElementById(
                "voice-preview"
              )
              ?.play();

          }
        );

      }


      if (rerecordBtn) {

        rerecordBtn.addEventListener(
          "click",
          () => {

            resetVoice();

            startVoice();

          }
        );

      }


      if (deleteBtn) {

        deleteBtn.addEventListener(
          "click",
          resetVoice
        );

      }


      /* ====================================================
         ADMIN ORIGINAL VOICE PLAYER
         ==================================================== */

      const queue =
        document.getElementById(
          "pending-queue-list"
        );


      if (queue) {

        const injectPlayers =
          () => {

            try {

              if (
                typeof STATE ===
                  "undefined" ||
                !Array.isArray(
                  STATE.pendingQueue
                )
              ) {

                return;

              }


              Array.from(
                queue.children
              ).forEach(
                (card, index) => {

                  const item =
                    STATE.pendingQueue[
                      index
                    ];


                  if (
                    !item?.voiceUrl ||
                    card.querySelector(
                      "[data-original-voice-player]"
                    )
                  ) {

                    return;

                  }


                  const wrap =
                    document.createElement(
                      "div"
                    );

                  wrap.setAttribute(
                    "data-original-voice-player",
                    "true"
                  );

                  wrap.style.margin =
                    "10px 0";


                  const label =
                    document.createElement(
                      "div"
                    );

                  label.textContent =
                    "🎙️ Original supporter voice";

                  label.style.fontSize =
                    ".75rem";

                  label.style.marginBottom =
                    "5px";


                  const audio =
                    document.createElement(
                      "audio"
                    );

                  audio.controls =
                    true;

                  audio.preload =
                    "metadata";

                  audio.src =
                    item.voiceUrl;

                  audio.style.width =
                    "100%";


                  wrap.appendChild(
                    label
                  );

                  wrap.appendChild(
                    audio
                  );


                  card
                    .querySelector(
                      ".admin-card-body"
                    )
                    ?.appendChild(
                      wrap
                    );

                }
              );


            } catch (err) {

              console.error(
                "Voice player injection error:",
                err
              );

            }

          };


        new MutationObserver(
          injectPlayers
        ).observe(
          queue,
          {
            childList: true
          }
        );


        injectPlayers();

      }

    }
  );


  /* ====================================================
     VOICE SUPPORT SUBMISSION
     ==================================================== */

  document.addEventListener(
    "submit",
    e => {

      if (
        e.target?.id !==
          "tip-form" ||
        !voiceBlob
      ) {

        return;

      }


      e.preventDefault();

      e.stopImmediatePropagation();


      const name =
        document
          .getElementById(
            "supporter-name"
          )
          ?.value
          .trim() || "";


      const custom =
        parseFloat(
          document
            .getElementById(
              "custom-amount"
            )
            ?.value
        );


      const activeCard =
        document.querySelector(
          ".donation-card.active"
        );


      const amount =
        custom > 0
          ? custom
          : Number(
              activeCard?.dataset
                .value || 50
            );


      const settings =
        window.__payuuVoiceSettings ||
        {};


      const minAmt =
        Number(
          settings.minAmount ||
          40
        );


      if (
        !name ||
        !amount ||
        amount < minAmt
      ) {

        alert(
          `Please enter a valid name and amount (Minimum ₹${minAmt}).`
        );

        return;

      }


      const msg =
        document
          .getElementById(
            "supporter-message"
          )
          ?.value
          .trim() || "";


      const now =
        new Date();


      const timeSubmitted =
        now.toLocaleTimeString(
          [],
          {
            hour: "2-digit",
            minute: "2-digit"
          }
        );


      // A voice support cannot proceed to payment until R2 upload succeeds.
      if (voiceUploadFailed) {
        alert(
          "Your voice message could not be uploaded. Please re-record it and try again."
        );
        return;
      }

      if (!voiceUploadUrl) {
        if (voiceUploadPromise) {
          setUploadStatus(
            "Please wait — your voice message is still uploading.",
            "uploading"
          );
          setPaymentLocked(true);
        } else {
          alert(
            "Please record a voice message and wait for the upload to complete."
          );
        }
        return;
      }

      try {

        STATE.activeSubmission = {

          name,

          amount:
            Number(amount),

          msg,

          messageSource:
            "voice",

          voiceEnabled:
            true,

          voiceUrl:
            voiceUploadUrl,

          voiceMimeType,

          voiceDuration,

          voiceStatus:
            "pending",

          timeSubmitted,

          status:
            STATUS.AWAITING_VERIFICATION

        };

      } catch (err) {

        console.error(
          "Voice submission state error:",
          err
        );

        return;

      }


      const note =
        `${name}: ${msg}`
          .substring(
            0,
            50
          );


      const upiId =
        settings.upiId ||
        document
          .getElementById(
            "upi-id-text"
          )
          ?.textContent ||
        "";


      const payee =
        settings.streamerName ||
        "Payuu Live";


      const upiUrl =
        `upi://pay?pa=${encodeURIComponent(
          upiId
        )}&pn=${encodeURIComponent(
          payee
        )}&am=${amount}&cu=INR&tn=${encodeURIComponent(
          note
        )}`;


      try {

        window.location.href =
          upiUrl;

      } catch (_) {}


      setTimeout(
        () => {

          const modal =
            document.getElementById(
              "confirm-payment-modal"
            );

          if (modal) {

            modal.classList.add(
              "active"
            );

          }

        },
        600
      );

    },
    true
  );


  /* ====================================================
     CONFIRM PAYMENT
     Voice has already been uploaded to R2 before payment.
     ==================================================== */

  document.addEventListener(
    "click",
    e => {

      if (e.target?.id !== "btn-paid-yes") {
        return;
      }

      if (
        voiceBlob &&
        (!voiceUploadUrl || voiceUploadFailed)
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();

        setPaymentLocked(true);

        if (voiceUploadPromise && !voiceUploadFailed) {
          setUploadStatus(
            "Please wait — your voice message is still uploading.",
            "uploading"
          );
        } else {
          setUploadStatus(
            "Voice upload is not complete. Payment cannot continue.",
            "error"
          );
        }

        return;
      }

      // Copy the already-uploaded R2 URL into the submission if needed.
      if (
        STATE.activeSubmission &&
        voiceUploadUrl
      ) {
        STATE.activeSubmission.voiceUrl = voiceUploadUrl;
        STATE.activeSubmission.voiceStatus = "pending";
        STATE.activeSubmission.voiceEnabled = true;
        STATE.activeSubmission.voiceMimeType = voiceMimeType;
        STATE.activeSubmission.voiceDuration = voiceDuration;
      }

    },
    true
  );


})();
