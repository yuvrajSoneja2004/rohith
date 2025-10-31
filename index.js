import express from "express";
import jwt from "jsonwebtoken";
import bodyParser from "body-parser";
import multer from "multer";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;
const SECRET = "your_jwt_secret"; // change for production

app.use(bodyParser.json());
app.use(cors());

// ---------------------- TEMP IN-MEMORY "DB" ----------------------
const db = {
  users: [],
  products: [],
};

// ---------------------- MULTER SETUP ----------------------
const storage = multer.memoryStorage(); // no file system writes
const upload = multer({ storage });

// ---------------------- LOGIN ----------------------
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  let user = db.users.find((u) => u.email === email);
  if (!user) {
    user = { id: Date.now().toString(), email, password, name: "", phone: "" };
    db.users.push(user);
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
  res.json(db.products);
});

// ---------------------- CREATE PRODUCT ----------------------
app.post("/products", auth, upload.array("images", 5), (req, res) => {
  const { name, price, description, location, userName, userPhone } = req.body;

  // Simulate image URLs
  const imagePaths = req.files.map((f, i) => `https://fakeimg.pl/300x200/?text=Image+${i + 1}`);

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
  res.json({ message: "Product created", product });
});

// ---------------------- UPDATE PRODUCT ----------------------
app.put("/products/:id", auth, upload.array("images", 5), (req, res) => {
  const { id } = req.params;
  const { name, price, description, location, userName, userPhone } = req.body;

  const index = db.products.findIndex((p) => p.id === id);
  if (index === -1) return res.status(404).json({ message: "Product not found" });

  const existing = db.products[index];
  const newImages = req.files.length
    ? req.files.map((f, i) => `https://fakeimg.pl/300x200/?text=Updated+${i + 1}`)
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

  res.json({ message: "Product updated", product: db.products[index] });
});

// ---------------------- DELETE PRODUCT ----------------------
app.delete("/products/:id", auth, (req, res) => {
  const { id } = req.params;
  const index = db.products.findIndex((p) => p.id === id);
  if (index === -1) return res.status(404).json({ message: "Product not found" });

  db.products.splice(index, 1);
  res.json({ message: "Product deleted" });
});

// ---------------------- START SERVER ----------------------
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
