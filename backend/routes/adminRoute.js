const { Router } = require("express");
const { protect, isAdmin } = require("../middlewares/authMiddleware");
const adminController = require("../controllers/adminController");

const adminRoute = Router();

adminRoute.get("/users", protect, isAdmin, adminController.listUsers);
adminRoute.get("/payments", protect, isAdmin, adminController.listPayments);
adminRoute.get("/revenue/monthly", protect, isAdmin, adminController.monthlyRevenue);
adminRoute.get("/reminders", protect, isAdmin, adminController.upcomingReminders);
adminRoute.delete("/users/:id", protect, isAdmin, adminController.deleteUser);
adminRoute.put("/users/:id", protect, isAdmin, adminController.updateUser);
adminRoute.delete("/payments/:id", protect, isAdmin, adminController.deletePayment);
adminRoute.get("/activity-log", protect, isAdmin, adminController.getActivityLog);

module.exports = adminRoute;

