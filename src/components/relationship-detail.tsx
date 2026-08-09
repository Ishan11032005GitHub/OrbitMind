import styles from "./relationship-detail.module.css";

export type DetailField = { label: string; value: string };
export type GraphNode = { label: string; meta?: string; tone?: "cyan" | "violet" | "pink" | "amber" };

export function DetailFields({ fields }: { fields: DetailField[] }) {
  return (
    <div className={styles.fields}>
      {fields.map((field) => (
        <div key={`${field.label}-${field.value}`}>
          <small>{field.label}</small>
          <b>{field.value}</b>
        </div>
      ))}
    </div>
  );
}

export function RelationshipGraph({ center, nodes }: { center: string; nodes: GraphNode[] }) {
  const visible = nodes.filter((node) => node.label).slice(0, 4);
  return (
    <section className={styles.graph} aria-label={`Relationship graph for ${center}`}>
      <header><small>RELATIONSHIP GRAPH</small><span>{visible.length} connected signals</span></header>
      <div className={styles.canvas}>
        <div className={styles.ring} />
        <div className={styles.ringTwo} />
        <div className={styles.center}><b>{center}</b><i /></div>
        {visible.map((node, index) => (
          <div className={`${styles.node} ${styles[`node${index + 1}`]} ${styles[node.tone ?? "cyan"]}`} key={`${node.label}-${index}`}>
            <span>{node.label}</span>{node.meta && <small>{node.meta}</small>}
          </div>
        ))}
      </div>
    </section>
  );
}
