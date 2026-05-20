import { useEffect, useMemo, useState } from "react";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function VirtualizedTableBody({
  rows,
  colSpan,
  rowHeight = 52,
  overscan = 8,
  scrollContainerRef,
  getRowKey,
  renderRow
}) {
  const totalRows = Array.isArray(rows) ? rows.length : 0;
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(520);

  useEffect(() => {
    const container = scrollContainerRef?.current;
    if (!container) return undefined;

    const updateMeasurements = () => {
      setScrollTop(container.scrollTop || 0);
      setViewportHeight(container.clientHeight || 520);
    };

    updateMeasurements();
    container.addEventListener("scroll", updateMeasurements, { passive: true });
    window.addEventListener("resize", updateMeasurements);

    return () => {
      container.removeEventListener("scroll", updateMeasurements);
      window.removeEventListener("resize", updateMeasurements);
    };
  }, [scrollContainerRef, totalRows]);

  const { startIndex, endIndex, topSpacerHeight, bottomSpacerHeight } = useMemo(() => {
    if (!totalRows) {
      return { startIndex: 0, endIndex: -1, topSpacerHeight: 0, bottomSpacerHeight: 0 };
    }

    const maxIndex = totalRows - 1;
    const firstVisible = clamp(Math.floor(scrollTop / rowHeight), 0, maxIndex);
    const visibleCount = Math.max(1, Math.ceil(viewportHeight / rowHeight));
    const start = clamp(firstVisible - overscan, 0, maxIndex);
    const end = clamp(firstVisible + visibleCount + overscan, start, maxIndex);

    return {
      startIndex: start,
      endIndex: end,
      topSpacerHeight: start * rowHeight,
      bottomSpacerHeight: (totalRows - end - 1) * rowHeight
    };
  }, [overscan, rowHeight, scrollTop, totalRows, viewportHeight]);

  const visibleRows = useMemo(
    () => (endIndex >= startIndex ? rows.slice(startIndex, endIndex + 1) : []),
    [rows, startIndex, endIndex]
  );

  const spacerStyle = { height: 0, padding: 0, border: "none" };

  return (
    <tbody>
      {topSpacerHeight > 0 ? (
        <tr aria-hidden="true">
          <td colSpan={colSpan} style={{ ...spacerStyle, height: `${topSpacerHeight}px` }} />
        </tr>
      ) : null}

      {visibleRows.map((row, offset) => renderRow(row, startIndex + offset, getRowKey(row, startIndex + offset)))}

      {bottomSpacerHeight > 0 ? (
        <tr aria-hidden="true">
          <td colSpan={colSpan} style={{ ...spacerStyle, height: `${bottomSpacerHeight}px` }} />
        </tr>
      ) : null}
    </tbody>
  );
}

export default VirtualizedTableBody;
