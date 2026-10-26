import { useCallback, useState } from "react";
import {
  ArrowUpRight,
  Box,
  Boxes,
  ClipboardList,
  Database,
  Grid3X3,
  Layers3,
  Ruler,
} from "lucide-react";
import { useLocalStorage } from "./hooks/useLocalStorage";
import type { Location, Order, Sku } from "./types";
import { CapacityCheck } from "./components/CapacityCheck";
import { OrderPlanner } from "./components/OrderPlanner";
import { LocationSetup, SkuSetup } from "./components/SetupViews";
import { defaultOrderLocationId } from "./utils/locations";
import { readLegacyData } from "./utils/legacyData";
import { attachCalculatedPlan, nextOrderName } from "./utils/savedOrders";
import { isLocations, isOrders, isSkus } from "./utils/workspaceValidation";

type View = "capacity" | "orders" | "skus" | "locations";
const navigation = [
  {
    id: "capacity",
    label: "Capacity check",
    icon: Box,
    description: "One SKU. One location.",
    title: "Find the perfect fit.",
    subtitle: "See how many cases and units fit in your space.",
  },
  {
    id: "orders",
    label: "Order planner",
    icon: ClipboardList,
    description: "Plan a complete order",
    title: "Every order. Space to fit.",
    subtitle: "Build your order and calculate the pallets or cages it needs.",
  },
  {
    id: "skus",
    label: "SKU setup",
    icon: Boxes,
    description: "Your product library",
    title: "Your products, all set.",
    subtitle: "Save case dimensions and units per case for every SKU.",
  },
  {
    id: "locations",
    label: "Location setup",
    icon: Grid3X3,
    description: "Define your available space",
    title: "A space for everything.",
    subtitle:
      "Set up pick faces, pallets and cages with your own usable dimensions.",
  },
] as const;

function App() {
  const [legacy] = useState(readLegacyData);
  const [storedView, setView, viewStorage] = useLocalStorage<View>(
    "location-box-fit.activeView",
    "capacity",
  );
  const view = navigation.some((item) => item.id === storedView)
    ? storedView
    : "capacity";
  const [locations, setLocations, locationStorage] = useLocalStorage<
    Location[]
  >("location-box-fit.locations", [], isLocations);
  const [skus, setSkus, skuStorage] = useLocalStorage<Sku[]>(
    "location-box-fit.skus.v2",
    legacy.skus,
    isSkus,
  );
  const [orders, setOrders, orderStorage] = useLocalStorage<Order[]>(
    "location-box-fit.orders.v2",
    legacy.orders,
    isOrders,
  );
  const [locationId, setLocationId, locationSelectionStorage] =
    useLocalStorage<string>("location-box-fit.selectedLocationId", "");
  const [orderId, setOrderId, orderSelectionStorage] = useLocalStorage<string>(
    "location-box-fit.orderId.v2",
    "",
  );
  const storageStates = [
    locationStorage,
    skuStorage,
    orderStorage,
    locationSelectionStorage,
    orderSelectionStorage,
    viewStorage,
  ];
  const readFailed = storageStates.some((item) => item.status === "read-error");
  const writeFailed = storageStates.some(
    (item) => item.status === "write-error",
  );
  const saving = storageStates.some((item) => item.status === "saving");
  const selectedLocationId = locations.some((item) => item.id === locationId)
    ? locationId
    : (locations[0]?.id ?? "");
  const order = orders.find((item) => item.id === orderId) ?? orders[0];
  const savePlan = useCallback(
    (source: Order, savedPlan: NonNullable<Order["savedPlan"]>) => {
      setOrders((current) =>
        current.map((item) =>
          item.id === source.id
            ? attachCalculatedPlan(item, source, savedPlan)
            : item,
        ),
      );
    },
    [setOrders],
  );
  const active = navigation.find((item) => item.id === view)!;
  const createOrder = () => {
    const next = {
      id: crypto.randomUUID(),
      name: nextOrderName(orders),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      locationId: defaultOrderLocationId(locations, selectedLocationId),
      lines: [],
    };
    setOrders((current) => [...current, next]);
    setOrderId(next.id);
  };
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setView("capacity");
          }}
        >
          <span className="brand-mark">
            <Layers3 size={24} />
          </span>
          <span>
            location<span className="brand-light">fit</span>
            <small>WAREHOUSE PLANNING</small>
          </span>
        </a>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map((item, index) => (
            <div key={item.id}>
              {index === 2 && (
                <p className="nav-label setup-label">YOUR LIBRARY</p>
              )}
              <button
                className={`nav-item ${view === item.id ? "active" : ""}`}
                aria-current={view === item.id ? "page" : undefined}
                onClick={() => setView(item.id)}
              >
                <item.icon size={20} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                {view === item.id && <span className="nav-dot" />}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div>
            <Database size={16} />
            <span>Workspace library</span>
          </div>
          <p>
            <strong>{locations.length}</strong> locations <span>·</span>{" "}
            <strong>{skus.length}</strong> SKUs
          </p>
          <small>{orders.length} orders · Browser storage</small>
        </div>
      </aside>
      <div className="main-content">
        <header className="topbar">
          <span>
            Workspace <span className="breadcrumb-slash">/</span>{" "}
            <strong>{active.label}</strong>
          </span>
          <span className="unit-badge">
            <Ruler size={14} /> Dimensions in cm
          </span>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {view === "capacity" || view === "orders"
                  ? "PLAN WITH CONFIDENCE"
                  : "WORKSPACE LIBRARY"}
              </p>
              <h1>{active.title}</h1>
              <p>{active.subtitle}</p>
            </div>
            {view === "capacity" && (
              <button
                className="button secondary shortcut"
                onClick={() => setView("orders")}
              >
                Plan a full order <ArrowUpRight size={16} />
              </button>
            )}
          </div>
          <div
            className={`workspace-storage ${readFailed || writeFailed ? "storage-error" : ""}`}
            role={readFailed || writeFailed ? "alert" : "status"}
          >
            <Database size={16} />
            <div>
              <strong>
                {readFailed
                  ? "Saved browser data could not be read"
                  : writeFailed
                    ? "Latest changes could not be saved"
                    : saving
                      ? "Saving in this browser…"
                      : "Saved in this browser"}
              </strong>
              <p>
                {readFailed
                  ? "Existing stored data has been left untouched. Restore browser storage access and reload before continuing."
                  : writeFailed
                    ? "Your latest changes are still in this tab. Browser storage may be full or unavailable; keep this tab open and retry saving."
                    : "Orders, calculated plans, SKUs and locations save automatically. Reopen this same site in this browser to continue. Clearing site data removes these records."}
              </p>
            </div>
            {writeFailed && !readFailed && (
              <button
                className="button secondary small"
                onClick={() => storageStates.forEach((item) => item.retry())}
              >
                Retry saving
              </button>
            )}
          </div>
          {legacy.imported && (
            <div className="migration-note">
              Your previous pack and order sheets were imported. Review the SKU
              codes and dimensions in setup; the original sheets are preserved.
            </div>
          )}
          {view === "capacity" && (
            <CapacityCheck
              locations={locations}
              skus={skus}
              locationId={selectedLocationId}
              onLocationChange={setLocationId}
              onSetup={() => setView("locations")}
            />
          )}
          {view === "orders" && (
            <OrderPlanner
              key={order?.id ?? "empty"}
              order={order}
              orders={orders}
              skus={skus}
              locations={locations}
              onChange={(updated) =>
                setOrders((current) =>
                  current.map((item) =>
                    item.id === updated.id
                      ? { ...updated, updatedAt: new Date().toISOString() }
                      : item,
                  ),
                )
              }
              onSelect={setOrderId}
              onPlanReady={savePlan}
              onNew={createOrder}
              onDelete={() => {
                setOrders(orders.filter((item) => item.id !== order?.id));
                setOrderId("");
              }}
            />
          )}
          {view === "skus" && (
            <SkuSetup skus={skus} orders={orders} onChange={setSkus} />
          )}
          {view === "locations" && (
            <LocationSetup
              locations={locations}
              selectedId={selectedLocationId}
              onSelect={setLocationId}
              onChange={setLocations}
            />
          )}
          <footer className="page-footer">
            <span className="status-dot" /> Built around your space{" "}
            <span>Location Fit</span>
          </footer>
        </div>
      </div>
    </main>
  );
}
export default App;
