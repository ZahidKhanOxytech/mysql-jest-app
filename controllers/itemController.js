const { pool } = require("../config/database");
const redis = require("ioredis");
const client = new redis();

exports.getAllItems = async (req, res) => {
  try {
    const cachedData = await client.get(`items`);

    if (cachedData) {
      res.status(200);
      res.json(JSON.parse(cachedData));
    } else {
      const [items] = await pool.promise().query("SELECT * FROM items");

      await client.set(`items`, JSON.stringify(items));

      res.status(200);
      res.json(items);
    }
  } catch (err) {
    console.log("err", err);
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.addItem = async (req, res) => {
  const { item_name, rate } = req.body;
  try {
    const [rows] = await pool
      .promise()
      .query("SELECT * FROM items WHERE item_name = ?", [item_name]);

    if (rows.length > 0) {
      res.status(409);
      return res.json({ message: "Item already exists!" });
    }

    const [result] = await pool
      .promise()
      .query("INSERT INTO items (item_name, rate) VALUES (?, ?)", [
        item_name,
        rate,
      ]);

    await client.del(`items`);

    res.status(201);
    res.json({ id: result.insertId, item_name, rate });
  } catch (err) {
    console.log("err", err);
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.updateItem = async (req, res) => {
  const { id } = req.params;
  const { item_name, rate } = req.body;
  try {
    // Update the item in the database
    const [result] = await pool.promise().query(
      `UPDATE items 
       SET item_name = ?, rate = ? 
       WHERE id = ?`,
      [item_name, rate, id]
    );

    if (result.affectedRows === 0) {
      res.status(404);
      return res.json({ message: "Item not found" });
    }

    // Fetch the updated item
    const [updatedItem] = await pool
      .promise()
      .query(`SELECT * FROM items WHERE id = ?`, [id]);

    await client.del(`items`);

    res.status(200);
    res.json(updatedItem[0]);
  } catch (err) {
    res.status(500);
    res.json({ message: err.message });
  }
};

exports.removeItem = async (req, res) => {
  const { id } = req.params;
  try {
    // Delete the item from the database
    const [result] = await pool
      .promise()
      .query(`DELETE FROM items WHERE id = ?`, [id]);

    if (result.affectedRows === 0) {
      res.status(404);
      return res.json({ message: "Item not found" });
    }

    await client.del(`items`);

    res.status(200);
    res.json({ message: "Item removed successfully" });
  } catch (err) {
    res.status(500);
    res.json({ message: err.message });
  }
};
