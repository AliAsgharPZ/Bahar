/**
 * KanbanPattern — Shadboard kanban layout pattern, rebuilt for Bahar.
 * Columns flow in the inline direction; cards move with accessible text
 * controls (previous / next column). Drag can be layered later with the
 * already installed dnd-kit; this pattern deliberately ships without drag
 * so it stays keyboard accessible and dependency-light.
 *
 * Server-safe: no client directive needed.
 */

import { faNumber } from "@/components/bahar/format";
import { cn } from "@/lib/utils";

export type KanbanCard = {
  id: string;
  title: string;
  meta?: string;
  badge?: string;
};

export type KanbanColumn = {
  id: string;
  title: string;
  cards: KanbanCard[];
};

export function KanbanPattern({
  columns,
  onMove,
  emptyText = "کارتی در این ستون نیست.",
  className,
}: {
  columns: KanbanColumn[];
  onMove?: (cardId: string, columnId: string, direction: "prev" | "next") => void;
  emptyText?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-4 overflow-x-auto pb-2", className)}>
      {columns.map((column, colIndex) => (
        <section
          key={column.id}
          className="b-card w-72 shrink-0 p-4"
          aria-label={column.title}
        >
          <header className="mb-4 flex items-center justify-between gap-4">
            <h3 className="text-base font-bold leading-tight text-ink">
              {column.title}
            </h3>
            <span className="b-badge b-badge-neutral">
              {faNumber(column.cards.length)}
            </span>
          </header>
          <div className="flex flex-col gap-4">
            {column.cards.length === 0 ? (
              <p className="text-sm leading-6 text-steel">{emptyText}</p>
            ) : (
              column.cards.map((card) => (
                <article key={card.id} className="b-card-sm p-4">
                  <p className="text-sm font-bold leading-6 text-ink">
                    {card.title}
                  </p>
                  {card.meta ? (
                    <p className="mt-2 text-xs leading-5 text-steel">
                      {card.meta}
                    </p>
                  ) : null}
                  {card.badge ? (
                    <p className="mt-2">
                      <span className="b-badge b-badge-spring">
                        {card.badge}
                      </span>
                    </p>
                  ) : null}
                  {onMove ? (
                    <div className="mt-4 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={colIndex === 0}
                        onClick={() => onMove(card.id, column.id, "prev")}
                        className="b-btn b-btn-ghost min-h-11 flex-1"
                      >
                        ستون قبل
                      </button>
                      <button
                        type="button"
                        disabled={colIndex === columns.length - 1}
                        onClick={() => onMove(card.id, column.id, "next")}
                        className="b-btn b-btn-ghost min-h-11 flex-1"
                      >
                        ستون بعد
                      </button>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
