/**
 * @file HTTP layer for the Admin-only settings update — parses the
 * request, calls `systemSettingsService.js`, and maps its thrown errors to
 * a status code and JSON body. The read side (`GET /` and `GET /current`)
 * is `shared/system-settings/systemSettingsController.js`.
 */
import SystemSettings from "../../shared/system-settings/systemSettingsService.js";

export const updateSettings = async (req, res) => {
  try {
    const updated = await SystemSettings.updateSettings(req.body, req.authUser.id);

    return res.status(200).json({
      message: "System settings updated successfully",
      data: updated,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: error.message || "Failed to update system settings",
    });
  }
};
