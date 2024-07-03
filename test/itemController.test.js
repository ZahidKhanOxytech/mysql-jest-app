const { pool } = require("../config/database");
const redis = require("ioredis");
const {
  addItem,
  getAllItems,
  updateItem,
  removeItem,
} = require("../controllers/itemController");
const client = new redis();

// Mock the pool and Redis client
jest.mock("../config/database", () => ({
  pool: {
    promise: jest.fn().mockReturnThis(),
    query: jest.fn(),
  },
}));

jest.mock("ioredis", () => {
  const mRedis = {
    del: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
  };
  return jest.fn(() => mRedis);
});

describe("getAllItems", () => {
  let req, res;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it("should return cached data if available", async () => {
    const cachedData = JSON.stringify([{ id: 1, name: "Item 1" }]);
    client.get.mockResolvedValue(cachedData);

    await getAllItems(req, res);

    expect(client.get).toHaveBeenCalledWith("items");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(JSON.parse(cachedData));
  });

  it("should fetch data from the database if cache is empty", async () => {
    const items = [{ id: 1, name: "Item 1" }];
    client.get.mockResolvedValue(null);
    pool.promise().query.mockResolvedValue([items]);

    await getAllItems(req, res);

    expect(client.get).toHaveBeenCalledWith("items");
    expect(pool.promise().query).toHaveBeenCalledWith("SELECT * FROM items");
    expect(client.set).toHaveBeenCalledWith("items", JSON.stringify(items));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(items);
  });

  it("should handle errors properly", async () => {
    const error = new Error("Database error");
    client.get.mockRejectedValue(error);

    await getAllItems(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});

describe("addItem", () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {
        item_name: "testItem",
        rate: 100,
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    pool.query.mockClear();
    client.del.mockClear();
  });

  it("should return 409 if item already exists", async () => {
    pool.query.mockResolvedValue([[{ id: 1 }]]);

    await addItem(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ message: "Item already exists!" });
  });

  it("should add item if it does not exist and return 201", async () => {
    pool.query.mockResolvedValueOnce([[]]);
    pool.query.mockResolvedValueOnce([{ insertId: 1 }]);

    await addItem(req, res);

    expect(pool.query).toHaveBeenCalledWith(
      "SELECT * FROM items WHERE item_name = ?",
      ["testItem"]
    );
    expect(pool.query).toHaveBeenCalledWith(
      "INSERT INTO items (item_name, rate) VALUES (?, ?)",
      ["testItem", 100]
    );
    expect(client.del).toHaveBeenCalledWith(`items`);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      id: 1,
      item_name: "testItem",
      rate: 100,
    });
  });

  it("should return 500 if an error occurs", async () => {
    const error = new Error("Database error");
    pool.query.mockRejectedValue(error);

    await addItem(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});

describe("updateItem", () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: { id: 1 },
      body: { item_name: "Updated Item", rate: 10.99 },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it("should update the item and return the updated item", async () => {
    const updateResult = { affectedRows: 1 };
    const updatedItem = [{ id: 1, item_name: "Updated Item", rate: 10.99 }];

    pool
      .promise()
      .query.mockResolvedValueOnce([updateResult])
      .mockResolvedValueOnce([updatedItem]);

    await updateItem(req, res);

    expect(pool.promise().query).toHaveBeenCalledWith(
      `UPDATE items 
       SET item_name = ?, rate = ? 
       WHERE id = ?`,
      ["Updated Item", 10.99, 1]
    );

    expect(pool.promise().query).toHaveBeenCalledWith(
      `SELECT * FROM items WHERE id = ?`,
      [1]
    );

    expect(client.del).toHaveBeenCalledWith("items");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(updatedItem[0]);
  });

  it("should return 404 if the item is not found", async () => {
    const updateResult = { affectedRows: 0 };

    pool.promise().query.mockResolvedValue([updateResult]);

    await updateItem(req, res);

    expect(pool.promise().query).toHaveBeenCalledWith(
      `UPDATE items 
       SET item_name = ?, rate = ? 
       WHERE id = ?`,
      ["Updated Item", 10.99, 1]
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Item not found" });
  });

  it("should handle errors properly", async () => {
    const error = new Error("Database error");

    pool.promise().query.mockRejectedValue(error);

    await updateItem(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});

describe("removeItem", () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: { id: 1 },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  it("should delete the item and return a success message", async () => {
    const deleteResult = { affectedRows: 1 };

    pool.promise().query.mockResolvedValueOnce([deleteResult]);

    await removeItem(req, res);

    expect(pool.promise().query).toHaveBeenCalledWith(
      `DELETE FROM items WHERE id = ?`,
      [1]
    );

    expect(client.del).toHaveBeenCalledWith("items");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Item removed successfully",
    });
  });

  it("should return 404 if the item is not found", async () => {
    const deleteResult = { affectedRows: 0 };

    pool.promise().query.mockResolvedValueOnce([deleteResult]);

    await removeItem(req, res);

    expect(pool.promise().query).toHaveBeenCalledWith(
      `DELETE FROM items WHERE id = ?`,
      [1]
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Item not found" });
  });

  it("should handle errors properly", async () => {
    const error = new Error("Database error");

    pool.promise().query.mockRejectedValue(error);

    await removeItem(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: error.message });
  });
});
