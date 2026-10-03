import React from 'react';
import { PropTypes } from 'prop-types';
import { Router } from 'react-router-dom';
import RisApp from '../Ris';

function App(props) {
  return (
    <Router history={props.history}>
      <RisApp />
    </Router>
  );
}

App.propTypes = {
  history: PropTypes.object.isRequired,
};

export default App;
