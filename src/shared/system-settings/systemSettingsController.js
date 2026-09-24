/**
 * @file HTTP layer for reading institution settings, open to any logged-in
 * user (`GET /current`) and to Admin for the full settings page (`GET /`)
 * — parses the request, calls `systemSettingsService.js`, and maps its
 * thrown errors to a status code and JSON body. The Admin-only update is
 * `admin/system-settings/systemSettingsController.js`.
 */
import SystemSettings from "./systemSettingsService.js";

export const getSettings = async (req, res) => {
  try {
    const settings = await SystemSettings.getSettings();

    return res.status(200).json({
      message: "System settings fetched successfully",
      data: settings,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || "Failed to fetch system settings",
    });
  }
};

// This is for updating the institution-wide system settings (Admin only, enforced at the route level)
