const express = require("express");
const router = express.Router();
const itemController = require("../controllers/itemController");

router.post("/add-item", itemController.addItem);
router.get("/get-all-items", itemController.getAllItems);
router.put("/update-item/:id", itemController.updateItem);
router.delete("/remove-item/:id", itemController.removeItem);

module.exports = router;
