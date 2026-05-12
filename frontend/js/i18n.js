const translations = {
  en: {
    dashboard: "Dashboard",
    intel_feed: "Intel Feed",
    strike_record: "Strike Record",
    system_config: "System Config",
    my_account: "My Account",
    log_out: "Log Out",
    streak: "STREAK",
    shield: "SHIELD",
    open_ai_console: "OPEN AI CONSOLE",
    save_changes: "SAVE CHANGES",
    edit_data: "EDIT DATA",
    user_profile: "User Profile",
    security_auth: "Security & Auth",
    preferences: "Preferences",
    danger_zone: "Danger Zone",
    missions_completed: "MISSIONS_COMPLETED",
    accuracy_rate: "ACCURACY_RATE",
    joined_date: "JOINED_DATE",
    language: "INTERFACE LANGUAGE",
    theme: "SYSTEM THEME",
    success_msg: "SUCCESS",
    failure_msg: "FAILURE",
    reset_system: "RESET SYSTEM"
  },
  vi: {
    dashboard: "Bảng Điều Khiển",
    intel_feed: "Dữ Liệu Tình Báo",
    strike_record: "Hồ Sơ Kỷ Luật",
    system_config: "Cấu Hình Hệ Thống",
    my_account: "Tài Khoản Của Tôi",
    log_out: "Đăng Xuất",
    streak: "CHUỖI",
    shield: "GIÁP",
    open_ai_console: "BẬT AI COACH",
    save_changes: "LƯU THAY ĐỔI",
    edit_data: "CHỈNH SỬA",
    user_profile: "Hồ Sơ Đặc Vụ",
    security_auth: "Bảo Mật & Liên Kết",
    preferences: "Tùy Chỉnh",
    danger_zone: "Vùng Nguy Hiểm",
    missions_completed: "NHIỆM VỤ HOÀN THÀNH",
    accuracy_rate: "TỶ LỆ CHÍNH XÁC",
    joined_date: "NGÀY GIA NHẬP",
    language: "NGÔN NGỮ GIAO DIỆN",
    theme: "GIAO DIỆN HỆ THỐNG",
    success_msg: "THÀNH CÔNG",
    failure_msg: "THẤT BẠI",
    reset_system: "KHÔI PHỤC HỆ THỐNG"
  }
};

export function getTranslation(key) {
  try {
    const lang = localStorage.getItem('sys_lang') || 'en';
    const dict = translations[lang] || translations['en'];
    return dict[key] || key;
  } catch (e) {
    return key;
  }
}

export function setLanguage(lang) {
  if (translations[lang]) {
    localStorage.setItem('sys_lang', lang);
    // Thay vì reload, ta phát ra một Event để App tự vẽ lại
    window.dispatchEvent(new CustomEvent('language-changed', { detail: lang }));
  }
}
