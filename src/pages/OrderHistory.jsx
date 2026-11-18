import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { CardSkeleton } from "../components/Skeleton.jsx";
import {
  getOrderItemStatus,
  orderSteps,
} from "../../server/shared/orderWorkflow.js";
import StatusBadge from "../components/StatusBadge.jsx";
import Modal from "../components/Modal.jsx";

const trackingSteps = ["Pending COD", ...orderSteps];
const money = (amount) =>
  Number(amount || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
  });
export default function OrderHistory() {
  const [orders, setOrders] = useState([]);
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
    api
      .orders()
      .then((data) => {
        if (active) {
          setOrders(data);
          setStatus({ loading: false, error: "", success: "" });
        }
      })
      .catch((error) => {
        if (active)
          setStatus({ loading: false, error: error.message, success: "" });
      });
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
  return (
    <section className="grid order-history" style={{ gap: 24 }}>
      <div className="page-hero">
        <h1 className="section-title">Order Tracking</h1>
        <p className="section-subtitle">
          Your purchases, delivery progress, and payment status.
        </p>
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
      {!status.loading && orders.length === 0 && (
        <div className="card empty-state orders-empty-state">
          You have no orders yet.
        </div>
      )}
      {orders.map((order) => {
        const activeItems = order.items.filter(
          (item) =>
            !["Cancelled", "Removed"].includes(getOrderItemStatus(order, item)),
        );
        const canCancel =
          activeItems.length > 0 &&
          activeItems.every(
            (item) => getOrderItemStatus(order, item) === "Pending COD",
          );
        const events = Array.from(
          new Map(
            order.items
              .flatMap((item) => item.trackingEvents || [])
              .map((event) => [`${event.status}:${event.at}`, event]),
          ).values(),
        ).sort((a, b) => String(a.at).localeCompare(String(b.at)));
        return (
          <article className="card order-card" key={order.id}>
            <header className="order-card-header">
              <div>
                <h2>{order.reference || "Your order"}</h2>
                <p>
                  {order.createdAt
                    ? new Date(order.createdAt).toLocaleString("en-PH")
                    : ""}
                </p>
              </div>
              <strong>{money(order.total)}</strong>
            </header>
            <p className="order-product-names">
              {order.items
                .map(
                  (item) =>
                    item.name || item.productName || "Unavailable product",
                )
                .join(" · ")}
            </p>
            <div className="order-statuses">
              <span>
                Delivery <StatusBadge status={order.status} />
              </span>
              <span>
                Payment <StatusBadge status={order.paymentStatus || "Unpaid"} />
              </span>
            </div>
            <details className="order-details">
              <summary>
                View {order.items.length}{" "}
                {order.items.length === 1 ? "product" : "products"} and tracking
              </summary>
              {!["Cancelled", "Removed"].includes(order.status) && (
                <ol className="order-timeline" aria-label="Order progress">
                  {trackingSteps.map((step, index) => (
                    <li
                      key={step}
                      aria-current={step === order.status ? "step" : undefined}
                      className={
                        index <= trackingSteps.indexOf(order.status)
                          ? "is-complete"
                          : ""
                      }
                    >
                      <StatusBadge status={step} />
                      <span className="order-timeline-label">
                        {step === order.status
                          ? "Current stage"
                          : index < trackingSteps.indexOf(order.status)
                            ? "Reached"
                            : "Upcoming"}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="order-items">
                {order.items.map((item, index) => {
                  const itemKey = item.itemId || `${index}-${item.productId}`;
                  const itemStatus = getOrderItemStatus(order, item);
                  return (
                    <section className="order-item" key={itemKey}>
                      <div>
                        <h3>
                          {item.name ||
                            item.productName ||
                            "Unavailable product"}
                        </h3>
                        <p>
                          Quantity {item.quantity} · {money(item.price)} each
                        </p>
                        <StatusBadge status={itemStatus} />
                        {item.returnedQuantity > 0 && (
                          <p>{item.returnedQuantity} returned</p>
                        )}
                      </div>
                      <div className="order-item-actions">
                        <strong>{money(item.price * item.quantity)}</strong>
                        {itemStatus === "Pending COD" && (
                          <button
                            className="button secondary"
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setCancellation({
                                order,
                                item: { ...item, itemId: itemKey },
                              })
                            }
                          >
                            Cancel item
                          </button>
                        )}
                        {itemStatus === "To Review" && (
                          <>
                            <button
                              className="button secondary"
                              type="button"
                              disabled={busy}
                              onClick={() => buyAgain(item)}
                            >
                              Buy Again
                            </button>
                            <Link
                              className="button secondary"
                              to={`/product/${item.productId}`}
                            >
                              Rate this Product
                            </Link>
                          </>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
              <section className="order-delivery">
                <h3>Delivery address</h3>
                <p>
                  {order.contactName}
                  <br />
                  {order.address}
                  <br />
                  {order.phone}
                </p>
                {order.addressSnapshot?.notes && (
                  <p>{order.addressSnapshot.notes}</p>
                )}
              </section>
              {events.length > 0 && (
                <details>
                  <summary>Tracking events</summary>
                  <ol className="order-events">
                    {events.map((event) => (
                      <li key={`${event.status}:${event.at}`}>
                        <StatusBadge status={event.status} />{" "}
                        <time dateTime={event.at}>
                          {new Date(event.at).toLocaleString("en-PH")}
                        </time>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              {order.refundedTotal > 0 && (
                <p>Verified refunds {money(order.refundedTotal)}</p>
              )}
              {canCancel && (
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => setCancellation({ order })}
                >
                  Cancel order
                </button>
              )}
            </details>
          </article>
        );
      })}
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
