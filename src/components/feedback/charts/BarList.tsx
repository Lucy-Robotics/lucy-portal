import React from 'react';

interface BarListProps {
  items: { key: string; label: string; count: number }[];
  // Percentages are relative to this (respondents, not selections)
  total: number;
  caption: string;
}

const BarList: React.FC<BarListProps> = ({ items, total, caption }) => {
  const max = Math.max(...items.map((i) => i.count), 1);
  const percent = (count: number) => (total ? Math.round((count / total) * 100) : 0);

  return (
    <figure className="chart-bar-list">
      <ul aria-hidden="true">
        {items.map((item) => (
          <li key={item.key} className="chart-bar-list__row" title={`${item.label}: ${item.count}`}>
            <span className="chart-bar-list__label">{item.label}</span>
            <span className="chart-bar-list__track">
              <span
                className="chart-bar-list__bar"
                style={{ width: `${(item.count / max) * 100}%` }}
              />
              <span className="chart-bar-list__value">
                {item.count} <span className="chart-muted">({percent(item.count)}%)</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
      {/* A table ignores the 1px sr-only width, so the wrapper hides it */}
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Option</th>
              <th scope="col">Answers</th>
              <th scope="col">Share of respondents</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.key}>
                <th scope="row">{item.label}</th>
                <td>{item.count}</td>
                <td>{percent(item.count)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
};

export default BarList;
