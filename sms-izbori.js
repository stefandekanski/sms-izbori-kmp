window.smsIzbori = {
  isIos: function() {
    if (typeof navigator === "undefined" || !navigator) return false;
    var platform = navigator.platform || "";
    var ua = navigator.userAgent || "";
    var maxTouchPoints = navigator.maxTouchPoints || 0;
    return /iPad|iPhone|iPod/.test(platform) ||
      /iPad|iPhone|iPod/.test(ua) ||
      (platform === "MacIntel" && maxTouchPoints > 1);
  },

  hasContactPicker: function() {
    return typeof navigator !== "undefined" && "contacts" in navigator && typeof window !== "undefined" && "ContactsManager" in window;
  },

  pickContact: function(callback) {
    if (!window.smsIzbori.hasContactPicker()) {
      callback(null, null, false);
      return;
    }
    navigator.contacts.select(["name", "tel"], { multiple: false })
      .then(function(contacts) {
        if (contacts && contacts.length > 0) {
          var c = contacts[0];
          var name = (c.name && c.name.length > 0) ? c.name[0] : null;
          var tel = (c.tel && c.tel.length > 0) ? c.tel[0] : null;
          callback(name, tel, true);
        } else {
          callback(null, null, false);
        }
      })
      .catch(function() {
        callback(null, null, false);
      });
  },

  openSms: function(number, body) {
    var sep = window.smsIzbori.isIos() ? "&" : "?";
    location.href = "sms:" + number + sep + "body=" + encodeURIComponent(body);
  },

  localMinutes: function(ms) {
    var d = new Date(ms);
    return d.getHours() * 60 + d.getMinutes();
  },

  openGuide: function() {
    location.href = "uputstvo.html";
  },

  appReady: function() {
    var boot = document.getElementById("boot");
    if (boot) {
      boot.remove();
    }
  }
};

if (typeof globalThis !== "undefined") {
  globalThis.smsIzbori = window.smsIzbori;
}
