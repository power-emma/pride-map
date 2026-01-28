import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import MapComponent from './MapComponent';
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>

      <h1>PrideMap!</h1>
        <MapComponent />
        <br/>
        <button onClick={() => setCount((count) => count + 1)}>
          Sample Button has been clicked {count} times
        </button>
        <p>
          
        </p>
      
      <div>

      </div>
      <p className="read-the-docs">
        Website is under construction!
      </p>
    </>
  )
}

export default App
