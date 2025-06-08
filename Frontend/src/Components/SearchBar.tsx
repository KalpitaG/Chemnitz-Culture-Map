import React from 'react';
import { Form, InputGroup } from 'react-bootstrap';

interface Props {
  value: string;
  onChange: (val: string) => void;
}

const SearchBar: React.FC<Props> = ({ value, onChange }) => (
  <InputGroup className="mb-3">
    <InputGroup.Text>🔍</InputGroup.Text>
    <Form.Control
      type="text"
      placeholder="Search by keyword..."
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </InputGroup>
);

export default SearchBar;
