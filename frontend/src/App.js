import { Route, Routes, Navigate } from "react-router-dom";
import EnterName from './components/enterName';
import Game from './components/game';
import Scores from './components/scores';
import Winner from './components/winner';

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path='/' element={<Navigate to='/enterName' replace />} />
        <Route path='/enterName' element={<EnterName />} />
        <Route path='/game' element={<Game />} />
        <Route path='/scores' element={<Scores />} />
        <Route path='/winner' element={<Winner />} />
      </Routes>
    </div>
  );
}

export default App;
