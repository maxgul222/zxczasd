import React from 'react';
import DoubleGame from './components/DoubleGame';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import styled from 'styled-components';

const AppContainer = styled.div`
  min-height: 100vh;
  background: #121212;
  padding: 20px;
`;

const Header = styled.header`
  text-align: center;
  color: white;
  margin-bottom: 30px;
`;

const Title = styled.h1`
  font-size: 2.5em;
  color: #ffd700;
  margin: 0;
  padding: 20px 0;
`;

function App() {
  return (
    <AppContainer>
      <Header>
        <Title>Casino Double</Title>
      </Header>
      <DoubleGame />
      <ToastContainer 
        position="bottom-right"
        theme="dark"
        autoClose={3000}
      />
    </AppContainer>
  );
}

export default App; 