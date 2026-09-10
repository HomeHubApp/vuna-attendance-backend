import Venue from "../services/venueService";

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

export const getVenues = async (req, res, next) => {
    try{
        const {all} = req.query;
        const venues = await Venue.getAllVenues({ activeOnly: all !== "true" });
        return res.status(200).json({ message: "Venues retrieved successfully", data: venues });
    }
    catch(error){
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to retrieve venues" });
    }
}

export const getVenue = async (req, res, next) => {
    try {
        const venue = await Venue.getVenueById(req.params.id);
        return res.status(200).json({ data: venue });
    } catch (error) {
        const status = error.statusCode || 500;
        return res.status(status).json({ success: false, error: error.message || "Failed to fetch venue" });
    }
}

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