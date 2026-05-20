function toComparableTimestamp(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }

  const parsedDate = new Date(value);
  if (!Number.isNaN(parsedDate.getTime())) {
    return parsedDate.getTime();
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function getNewestSortValue(row) {
  return (
    toComparableTimestamp(row?.createdAt)
    ?? toComparableTimestamp(row?.updatedAt)
    ?? toComparableTimestamp(row?.id)
    ?? Number.NEGATIVE_INFINITY
  );
}

function compareIdsDescending(leftId, rightId) {
  const leftNumeric = Number(leftId);
  const rightNumeric = Number(rightId);

  if (Number.isFinite(leftNumeric) && Number.isFinite(rightNumeric) && leftNumeric !== rightNumeric) {
    return rightNumeric - leftNumeric;
  }

  return String(rightId ?? "").localeCompare(String(leftId ?? ""), undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

export function sortByNewestFirst(rows) {
  if (!Array.isArray(rows)) return [];

  return [...rows].sort((left, right) => {
    const timeDifference = getNewestSortValue(right) - getNewestSortValue(left);
    if (timeDifference !== 0) {
      return timeDifference;
    }

    return compareIdsDescending(left?.id, right?.id);
  });
}
