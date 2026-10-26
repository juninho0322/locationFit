import { useState } from "react";
import type { Location, Order } from "../types";
import { findSavedOrders } from "../utils/savedOrders";
import { Field } from "./PlannerFields";

export function SavedOrders({
  orders,
  selectedId,
  locations,
  onSelect,
}: {
  orders: Order[];
  selectedId?: string;
  locations: Location[];
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const matches = findSavedOrders(orders, search);
  return (
    <section className="panel order-history" aria-label="Saved orders">
      <div className="order-history-heading">
        <div>
          <h3>
            Saved orders <span className="count">{orders.length}</span>
          </h3>
          <p className="helper">
            Select an order to reopen it. Creating a new order keeps your
            previous orders.
          </p>
        </div>
        <Field label="Find an order">
          <input
            type="search"
            placeholder="Search order number…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </Field>
      </div>
      <div className="order-history-list">
        {matches.map((order) => {
          const active = order.id === selectedId;
          const updated = order.updatedAt ? new Date(order.updatedAt) : null;
          return (
            <button
              key={order.id}
              type="button"
              className={`order-history-row ${active ? "active" : ""}`}
              aria-pressed={active}
              onClick={() => onSelect(order.id)}
            >
              <span>
                <strong>{order.name || "Untitled order"}</strong>
                <small>
                  {locations.find(
                    (location) => location.id === order.locationId,
                  )?.name || "No location selected"}{" "}
                  · {order.lines.length}{" "}
                  {order.lines.length === 1 ? "line" : "lines"}
                </small>
              </span>
              <span className="order-history-meta">
                {updated && !Number.isNaN(updated.getTime()) && (
                  <small>
                    Updated{" "}
                    {updated.toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </small>
                )}
                <span>{active ? "Current order" : "Open order"}</span>
              </span>
            </button>
          );
        })}
        {!matches.length && (
          <p className="helper">No orders match this search.</p>
        )}
      </div>
    </section>
  );
}
