const { Router } = require('express');
const eventController = require('../controllers/eventController');
const { protect, isAdmin } = require('../middlewares/authMiddleware'); 
const { upload } = require('../middlewares/upload'); 

const eventRoute = Router();

eventRoute.get('/all', eventController.getAllEvents);
eventRoute.get("/featured", eventController.getFeaturedEvents);
eventRoute.get("/categories", eventController.getEventCategories);
eventRoute.get('/:id', eventController.getEventById);

eventRoute.post('/book/:id', protect, eventController.bookEvent);

eventRoute.post('/create', protect, isAdmin, upload.single('image'), eventController.createEvent);

eventRoute.put('/update/:id', protect, isAdmin, upload.single('image'), eventController.updateEvent);

eventRoute.delete('/delete/:id', protect, isAdmin, eventController.deleteEvent);

module.exports = eventRoute;
