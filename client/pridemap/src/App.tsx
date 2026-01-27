import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>

      <h1>PrideMap!</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
        Sample Button has been clicked {count} times
        </button>
        <p>
          This main file is stored in <code>client/pridemap/src/App.tsx</code>
        </p>
      </div>
      <div>

      </div>
      <p className="read-the-docs">
        Website is under construction!
      </p>
    </>
  )
}

export default App
