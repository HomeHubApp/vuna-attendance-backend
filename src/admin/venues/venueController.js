/**
 * @file HTTP layer for the Admin-only venue actions (create, update,
 * deactivate) — parses the request, calls `venueService.js`, and maps its
 * thrown errors to a status code and JSON body. The read side is
 * `shared/venues/venueController.js`.
 */
import Venue from "../../shared/venues/venueService.js";

export const createVenue = async (req, res, next) => {
  try {
    const venue = await Venue.createVenue(req.body, req.authUser.id);
    return res
      .status(201)
      .json({ message: "Venue created successfully", data: venue });
  } catch (error) {
    const status = error.statusCode || 500;
    return res
      .status(status)
      .json({
        success: false,
        error: error.message || "Failed to create venue",
      });
  }
};

export const updateVenue = async (req, res) => {
    try {
        const venue = await Venue.updateVenue(req.params.id, req.body);
        return res.status(200).json({ message: "Venue updated successfully", data: venue });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to update venue" });
    }
};

export const deleteVenue = async (req, res) => {
    try {
        const result = await Venue.deactivateVenue(req.params.id);
        return res.status(200).json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to delete venue" });
    }
};
