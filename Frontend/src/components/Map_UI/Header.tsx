import React from 'react';
import { Navbar } from 'react-bootstrap';

const Header: React.FC = () => (
  <Navbar bg="dark" variant="dark" expand="lg">
    <Navbar.Brand className="ms-3">Chemnitz Culture Map</Navbar.Brand>
  </Navbar>
);

export default Header;
