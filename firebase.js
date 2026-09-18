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
    const email = String(userEmail || "").trim().toLowerCase();
    if (!email) {
      callback(null);
      return;
    }

    const key = email.replace(/[@.]/g, "_");

    db.ref("admins/" + key)
      .once("value")
      .then(snapshot => {
        const record = snapshot.val();
        callback(
          record
            ? { uid: key, ...record }
            : null
        );
      })
      .catch(error => {
        console.warn("Admin status lookup failed:", error);
        callback(null);
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
        auth.currentUser?.email ||
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

        const voiceKey = data.voiceKey || data.key || "";
        if (!voiceKey) {
          throw new Error("Voice upload completed without a voice key.");
        }
        return {
          voiceKey,
          voiceUrl: "/api/play-voice?key=" + encodeURIComponent(voiceKey)
        };

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

        voiceKey:
          data.voiceKey ||
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

        voiceKey:
          data.voiceKey ||
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
          data.voiceKey
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

        voiceKey:
          data.voiceKey ||
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
        .then(() =>
          this.pushOverlayAlert(
            duplicatePayload,
            approvedRef.key
          )
        )
        .then(() => approvedRef.key);

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

        voiceKey:
          data.voiceKey ||
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
            data.voiceKey
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
