import StoreIcon from '../components/StoreIcon.jsx';
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { CardSkeleton } from "../components/Skeleton.jsx";
import { normalizeOrderStatus } from "../../server/shared/orderWorkflow.js";
import OrderTrackingCard from "../components/OrderTrackingCard.jsx";
import Modal from "../components/Modal.jsx";

const filters = [
  { label: "All" },
  { label: "Pending", stages: ["Pending COD"] },
  { label: "To ship", stages: ["Approved", "To Ship"] },
  { label: "To receive", stages: ["To Receive"] },
  { label: "Delivered", stages: ["To Review"] },
  { label: "Cancelled", stages: ["Cancelled"] },
];

export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
  const [images, setImages] = useState(() => new Map());
  const [filter, setFilter] = useState(filters[0]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState({
    loading: true,
    error: "",
    success: "",
  });
  const [cancellation, setCancellation] = useState(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await api.orders();
        if (!active) return;
        setOrders(data);
        setStatus({ loading: false, error: "", success: "" });
        if (!data.length) return;
      } catch (error) {
        if (active) setStatus({ loading: false, error: error.message, success: "" });
        return;
      }
      // Older order snapshots have no photo. Catalog availability is independent of tracking.
      try {
        const products = await api.products();
        if (!active) return;
        const byId = new Map();
        for (const product of products) {
          const photo = product.imageUrls?.[0] || product.imageUrl;
          byId.set(String(product.id), photo);
          if (product.legacyId) byId.set(String(product.legacyId), photo);
        }
        setImages(byId);
      } catch { /* The thumbnail displays a bottle when the catalog is unavailable. */ }
    };
    load();
    return () => {
      active = false;
    };
  }, []);
  const cancel = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const updated = cancellation.item
        ? await api.cancelOrderItem(
            cancellation.order.id,
            cancellation.item.itemId,
          )
        : await api.cancelOrder(cancellation.order.id);
      setOrders((previous) =>
        previous.map((order) => (order.id === updated.id ? updated : order)),
      );
      setCancellation(null);
      setStatus((previous) => ({
        ...previous,
        error: "",
        success: "Cancellation recorded.",
      }));
    } catch (error) {
      setStatus((previous) => ({ ...previous, error: error.message }));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const buyAgain = async (item) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try {
      const product = await api.product(item.productId);
      if (product.stock < 1) throw new Error("This product is out of stock.");
      localStorage.setItem(
        `severino_direct_checkout_${user.id}`,
        JSON.stringify({
          productId: product.id,
          quantity: 1,
          createdAt: Date.now(),
        }),
      );
      localStorage.removeItem(`checkout_selection_${user.id}`);
      navigate("/checkout");
    } catch (error) {
      setStatus((previous) => ({ ...previous, error: error.message }));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const term = query.trim().toLowerCase();
  const visibleOrders = orders.filter(order => {
    if (filter.stages && !filter.stages.includes(normalizeOrderStatus(order.status))) return false;
    const names = [order.reference, ...order.items.map(item => item.name || item.productName)];
    return !term || names.some(name => name?.toLowerCase().includes(term));
  });

  return (
    <section className="order-history boutique-page">
      <header className="purchase-tools">
        <h1 className="section-title">Order Tracking</h1>
        <label className="purchase-search">
          <StoreIcon name="search" />
          <span className="sr-only">Search orders by product or order reference</span>
          <input id="order-search" type="search" placeholder="Search your orders" value={query} onChange={event => setQuery(event.target.value)} />
        </label>
      </header>
      <div className="purchase-filters" role="group" aria-label="Filter orders by delivery status">
        {filters.map(option => <button key={option.label} type="button" aria-pressed={filter === option} onClick={() => setFilter(option)}>
          {option.label}
        </button>)}
      </div>
      {status.loading && <CardSkeleton lines={5} />}
      {status.error && (
        <p className="store-notice" role="alert">
          {status.error}
        </p>
      )}
      {status.success && (
        <p className="store-notice" role="status">
          {status.success}
        </p>
      )}
      {!status.loading && !status.error && visibleOrders.length === 0 && (
        <div className="card empty-state orders-empty-state" role="status">
          {orders.length ? "No orders match your search or filter." : "You have no orders yet."}
          {orders.length > 0 && <button type="button" className="store-text-link" onClick={() => { setFilter(filters[0]); setQuery(""); }}>Show all orders</button>}
        </div>
      )}
      {visibleOrders.map(order => (
        <OrderTrackingCard key={order.id} order={order} images={images} busy={busy} onBuyAgain={buyAgain} onCancel={setCancellation} />
      ))}
      {cancellation && (
        <Modal
          className="order-cancel-backdrop"
          onClick={() => {
            if (!pending.current) setCancellation(null);
          }}
        >
          <div
            className="modal-card order-cancel-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-order-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="cancel-order-title">
              {cancellation.item ? "Cancel this item?" : "Cancel this order?"}
            </h2>
            <p>{cancellation.item?.name || cancellation.order.reference}</p>
            <p>Reserved stock will become available again.</p>
            {status.error && (
              <p className="order-cancel-error" role="alert">
                {status.error}
              </p>
            )}
            <div className="address-actions">
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => setCancellation(null)}
              >
                Keep {cancellation.item ? "item" : "order"}
              </button>
              <button
                className="button"
                type="button"
                disabled={busy}
                onClick={cancel}
              >
                {busy ? "Cancelling…" : "Confirm cancellation"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
