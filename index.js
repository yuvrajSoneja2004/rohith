import express from "express";
import fs from "fs";
import jwt from "jsonwebtoken";
import bodyParser from "body-parser";
import multer from "multer";
import cors from "cors";

const app = express();
const PORT = 4000;
const SECRET = "your_jwt_secret"; // change for production

app.use(bodyParser.json());
app.use("/uploads", express.static("uploads"));
app.use(cors());

// ---------------------- MULTER SETUP ----------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// ---------------------- DB HELPERS ----------------------
function readDB() {
  if (!fs.existsSync("db.json")) {
    fs.writeFileSync("db.json", JSON.stringify({ users: [], products: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync("db.json", "utf-8"));
}
function writeDB(data) {
  fs.writeFileSync("db.json", JSON.stringify(data, null, 2));
}

// ---------------------- LOGIN ----------------------
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  let user = db.users.find((u) => u.email === email);

  if (!user) {
    // Create new user if not found
    user = { id: Date.now().toString(), email, password, name: "", phone: "" };
    db.users.push(user);
    writeDB(db);
  }

  if (user.password !== password) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ id: user.id, email: user.email }, SECRET, { expiresIn: "2h" });
  res.json({ token });
});

// ---------------------- AUTH MIDDLEWARE ----------------------
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "Missing token" });

  const token = header.split(" ")[1];
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(403).json({ message: "Invalid token" });
  }
}

// ---------------------- GET PRODUCTS ----------------------
app.get("/products", auth, (req, res) => {
  const db = readDB();
  res.json(db.products);
});

// ---------------------- CREATE PRODUCT ----------------------
app.post("/products", auth, upload.array("images", 5), (req, res) => {
  const { name, price, description, location, userName, userPhone } = req.body;

  const imagePaths = req.files.map(
    (f) => `${req.protocol}://${req.get("host")}/uploads/${f.filename}`
  );

  const db = readDB();
  const product = {
    id: Date.now().toString(),
    name,
    price,
    description,
    location,
    images: imagePaths,
    user: {
      id: req.user.id,
      name: userName,
      phone: userPhone,
    },
  };

  db.products.push(product);
  writeDB(db);

  res.json({ message: "Product created", product });
});

// ---------------------- UPDATE PRODUCT ----------------------
app.put("/products/:id", auth, upload.array("images", 5), (req, res) => {
  const { id } = req.params;
  const { name, price, description, location, userName, userPhone } = req.body;

  const db = readDB();
  const index = db.products.findIndex((p) => p.id === id);
  if (index === -1) return res.status(404).json({ message: "Product not found" });

  const existing = db.products[index];
  const newImages = req.files.length
    ? req.files.map((f) => `${req.protocol}://${req.get("host")}/uploads/${f.filename}`)
    : existing.images;

  db.products[index] = {
    ...existing,
    name: name || existing.name,
    price: price || existing.price,
    description: description || existing.description,
    location: location || existing.location,
    images: newImages,
    user: {
      ...existing.user,
      name: userName || existing.user.name,
      phone: userPhone || existing.user.phone,
    },
  };

  writeDB(db);
  res.json({ message: "Product updated", product: db.products[index] });
});

// ---------------------- DELETE PRODUCT ----------------------
app.delete("/products/:id", auth, (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const index = db.products.findIndex((p) => p.id === id);
  if (index === -1) return res.status(404).json({ message: "Product not found" });

  // optional: delete image files from /uploads
  const product = db.products[index];
  product.images.forEach((imgUrl) => {
    const filePath = imgUrl.split("/uploads/")[1];
    if (filePath && fs.existsSync(`uploads/${filePath}`)) {
      fs.unlinkSync(`uploads/${filePath}`);
    }
  });

  db.products.splice(index, 1);
  writeDB(db);

  res.json({ message: "Product deleted" });
});

// ---------------------- START SERVER ----------------------
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
