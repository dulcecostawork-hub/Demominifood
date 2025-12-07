
import express from "express";
import cors from "cors";

const app = express();

// Middlewares
app.use(express.json());
app.use(cors());

// ---- Dados em memória (seed) ----
let meals;

function seed() {
  meals = [
    { id: 1, name: "Massa à Bolonhesa", price: 11.9, stock: 5 },
    { id: 2, name: "Salada Mediterrânica", price: 9.5, stock: 3 },
    { id: 3, name: "Caril de Frango", price: 12.5, stock: 0 }, // esgotado p/ demo
    { id: 4, name: "Hambúrguer Clássico", price: 10.9, stock: 8 },
  ];
}
seed();

// Helpers
const findMeal = (id) => meals.find((m) => m.id === id);
const isEmail = (x) => typeof x === "string" && x.includes("@");
const totalOf = (items) =>
  Number(
    items
      .reduce((sum, it) => {
        const m = findMeal(it.mealId);
        return sum + (m ? m.price * it.qty : 0);
      }, 0)
      .toFixed(2)
  );

// Health Check
app.get("/api/health", (_, res) => res.json({ ok: true }));

// Listar refeições
app.get("/api/meals", (_, res) => res.json(meals));

/**
 * POST /api/cart
 * Body: { mealId, qty }
 */
app.post("/api/cart", (req, res) => {
  const { mealId, qty } = req.body ?? {};
  const m = findMeal(mealId);

  if (!m)
    return res
      .status(404)
      .json({ ok: false, code: "NOT_FOUND", message: "Prato não existe" });

  if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
    return res
      .status(422)
      .json({ ok: false, code: "INVALID_QTY", message: "qty deve ser 1..10" });
  }

  if (m.stock < qty) {
    return res.status(409).json({
      ok: false,
      code: "OUT_OF_STOCK",
      message: "Sem stock suficiente",
      available: m.stock,
    });
  }

  return res
    .status(201)
    .json({ ok: true, item: { mealId, qty, unitPrice: m.price } });
});

/**
 * POST /api/checkout
 * Body: { items:[{mealId, qty}], customer:{ email, acceptTerms } }
 * NOTA: email NÃO é validado no backend (para demo desalinhamento FE vs BE)
 */
app.post("/api/checkout", (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const customer = req.body?.customer ?? {};

  if (items.length === 0) {
    return res
      .status(422)
      .json({ ok: false, code: "INVALID_CART", message: "Carrinho vazio" });
  }

  for (const it of items) {
    const m = findMeal(it.mealId);
    if (!m)
      return res.status(404).json({
        ok: false,
        code: "NOT_FOUND",
        message: `Prato ${it.mealId} não existe`,
      });

    if (!Number.isInteger(it.qty) || it.qty < 1) {
      return res.status(422).json({
        ok: false,
        code: "INVALID_QTY",
        message: "qty inválido",
        path: "items[].qty",
      });
    }

    if (m.stock < it.qty) {
      return res.status(409).json({
        ok: false,
        code: "OUT_OF_STOCK",
        message: "Sem stock",
        details: { mealId: m.id, available: m.stock },
      });
    }
  }

  // (Propositadamente) NÃO validamos email aqui
  // if (!isEmail(customer.email)) {
  //   return res.status(422).json({ ok:false, code:"INVALID_FIELD", message:"Email obrigatório", path:"customer.email" });
  // }

  if (customer.acceptTerms !== true) {
    return res.status(412).json({
      ok: false,
      code: "TERMS_NOT_ACCEPTED",
      message: "É necessário aceitar os termos",
    });
  }

  const total = totalOf(items);
  if (total < 10) {
    return res.status(400).json({
      ok: false,
      code: "MIN_ORDER_NOT_MET",
      message: "Encomenda mínima €10",
      minimum: 10,
      total,
    });
  }

  // Atualiza stock
  for (const it of items) {
    const m = findMeal(it.mealId);
    m.stock -= it.qty;
  }

  const orderId = Date.now();
  return res.status(201).json({ ok: true, orderId, total });
});

// Reset para admin
app.post("/api/admin/reset", (_, res) => {
  seed();
  res.json({ ok: true });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API on :${PORT}`));
