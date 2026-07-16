// The samples already on the sheet, as a tap-to-edit list rather than a grid of
// inputs. Each card shows only what tells one sample apart from another; the
// rest lives in the form behind it, and all of it still prints.
function SampleList({ rows, summarize, onAdd, onEdit, onRemove, readOnly }) {
  return (
    <div className="sample-list">
      <div className="sample-list-head">
        <span className="sample-list-count">
          {rows.length} sample{rows.length !== 1 ? "s" : ""}
        </span>
        {!readOnly && (
          <button type="button" className="order-btn-primary" onClick={onAdd}>+ Add Sample</button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="sample-list-empty">No samples recorded yet.</p>
      ) : (
        <ul className="sample-cards">
          {rows.map((row, index) => {
            const { primary, secondary } = summarize(row);
            return (
              <li key={index} className="sample-card">
                <button
                  type="button"
                  className="sample-card-main"
                  onClick={() => !readOnly && onEdit(index)}
                  disabled={readOnly}
                >
                  <span className="sample-card-index">#{index + 1}</span>
                  <span className="sample-card-text">
                    <span className="sample-card-primary">{primary}</span>
                    <span className="sample-card-secondary">{secondary}</span>
                  </span>
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    className="sample-card-remove"
                    onClick={() => onRemove(index)}
                    aria-label={`Remove sample ${index + 1}`}
                  >
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default SampleList;
