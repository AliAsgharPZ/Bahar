/**
 * BaharDataTable — BoardUI-style data table, rebuilt for Bahar on top of
 * the already installed shadcn table primitives.
 *
 * Bahar customizations: .b-card shell, text-start headers, actions at the
 * inline end, Persian empty state. Callers pass cell nodes; action buttons
 * inside cells must themselves be at least 44 high (use .b-btn).
 */

import * as React from "react";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type BaharColumn = {
  key: string;
  title: string;
};

export function BaharDataTable({
  columns,
  rows,
  caption,
  emptyText = "موردی یافت نشد.",
  className,
}: {
  columns: BaharColumn[];
  rows: Record<string, React.ReactNode>[];
  caption?: string;
  emptyText?: string;
  className?: string;
}) {
  return (
    <div className={cn("b-card overflow-x-auto", className)}>
      <Table>
        {caption ? <TableCaption>{caption}</TableCaption> : null}
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.key} className="text-start">
                {col.title}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-8 text-center text-sm text-steel"
              >
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell key={col.key}>{row[col.key]}</TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
