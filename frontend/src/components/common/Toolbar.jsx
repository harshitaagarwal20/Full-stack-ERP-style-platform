import Card from "./Card";

function Toolbar({ title, search, actions, filters }) {
  return (
    <Card className="ui-toolbar">
      <div className="ui-toolbar-row">
        {title ? <h2>{title}</h2> : <span />}
        <div className="ui-toolbar-right">
          {search}
          {actions}
        </div>
      </div>
      {filters ? <div className="ui-toolbar-filters">{filters}</div> : null}
    </Card>
  );
}

export default Toolbar;
