import React from 'react';
import type { TimelineItem } from '../types/timeline';
import '../styles/roadmap.css';

const mockItems: Omit<TimelineItem, 'getDateLabel'>[] = [
  {
    title: 'Project Kick-off',
    description: 'Initial planning and team alignment. The journey begins!Initial planning and team alignment. The journey begins!Initial planning and team alignment. The journey begins!Initial planning and team alignment. The journey begins!',
    done: true,
  },
  {
    title: 'First Mockups',
    description: 'Designing.',
    done: true,
  },
  {
    title: 'Alpha Release',
    description: 'FiInitial planning and team alignment. The journey begins!Initial planning and team alignment. The journey begins!Initial planning and team alignment. The journey begins!Initial planning and team alignment. The journey begins!Initial planning and team alignment. The journey begins!rst functional version for internal testing.',
    done: false,
    link: { href: '#', text: 'Changelog' },
  },
  {
    title: 'Public Beta',
    description: 'Feature-complete version for public feedback.',
    done: false,
  },
];

const Roadmap: React.FC = () => {
  return (
    <div className="roadmap-page-container">
      <h1>Roadmap</h1>
      <ul className="timeline-list">
        {mockItems.map((item, index) => {
          const isFirst = index === 0;
          const isLast = index === mockItems.length - 1;
          const done = item.done ?? true;

          return (
            <li key={index} className={`timeline-item ${done ? '' : 'italic'}`}>
              <div className="date-label">{done ? "Shipped" : "Soon"}</div>

              <div className="checkbox-container">
                <input type="checkbox" checked={done} readOnly className="checkbox" />
                <div className={`line-container ${isFirst ? 'justify-end' : ''}`}>
                  <div
                    className={`line ${isFirst ? 'rounded-t-full' : ''} ${isLast ? 'rounded-b-full' : ''} ${
                      isFirst || isLast ? 'h-half' : 'h-full'
                    }`}
                  ></div>
                </div>
              </div>



              <div className={`card ${isLast ? '' : ''}`}>
                <div className="card-body">
                  <div className="card-content">
                    <div className="card-header">
                      <div className="header-left">
                        <span className={`title ${done ? '' : 'text-secondary italic'}`}>{item.title}</span>
                      </div>
                      <div className="header-right">
                        {item.link && (
                          <a href={item.link.href} className="link">
                            [{item.link.text}]
                          </a>
                        )}
                      </div>
                    </div>
                    <p className="description">{item.description}</p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default Roadmap;
