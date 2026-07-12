import Card from "./Card";

// Unified page toolbar: a header card (title + actions), then a single card
// holding the full-width search and the filter row. Same shape the Enquiry and
// Order pages use, so every list page reads the same way.
function Toolbar({ title, search, actions, filters }) {
  return (
    <>
      {(title || actions) && (
        <Card className="ui-toolbar">
          <div className="order-header-card">
            <div className="order-header-left">{title ? <h2>{title}</h2> : <span />}</div>
            {actions ? <div className="order-header-right">{actions}</div> : null}
          </div>
        </Card>
      )}

      {(search || filters) && (
        <Card className="ui-toolbar">
          {search ? <div className="unified-search-box">{search}</div> : null}
          {filters ? <div className="unified-filter-row">{filters}</div> : null}
        </Card>
      )}
    </>
  );
}

export default Toolbar;
