/**
 * @file HTTP layer for the read-only venue endpoints, open to any
 * logged-in user — parses the request, calls `venueService.js`, and maps
 * its thrown errors to a status code and JSON body. The Admin-only writes
 * are `admin/venues/venueController.js`.
 */
import Venue from "./venueService.js";

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
