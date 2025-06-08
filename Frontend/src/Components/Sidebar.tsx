import React from 'react';
import { Button, ButtonGroup } from 'react-bootstrap';

interface Props {
  onFilter: (category: string) => void;
  activeCategory: string;
}

const categories = [
  { name: 'museum', label: 'Museums' },
  { name: 'theatre', label: 'Theatres' },
  { name: 'restaurant', label: 'Restaurants' },
  { name: 'artwork', label: 'Artworks' },
];

const Sidebar: React.FC<Props> = ({ onFilter, activeCategory }) => (
  <div className="p-3 bg-light rounded shadow-sm mb-3">
    <h5 className="mb-3">Filter by Category</h5>
    <ButtonGroup vertical>
      {categories.map((cat) => (
        <Button
          key={cat.name}
          variant={activeCategory === cat.name ? 'primary' : 'outline-primary'}
          onClick={() => onFilter(cat.name)}
        >
          {cat.label}
        </Button>
      ))}
    </ButtonGroup>
  </div>
);

export default Sidebar;
