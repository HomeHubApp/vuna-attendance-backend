import SystemSettings from "../services/systemSettingsService.js";

// This is for fetching the institution-wide system settings
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
