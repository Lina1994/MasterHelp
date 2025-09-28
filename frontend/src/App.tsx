import { RouterProvider } from 'react-router-dom';
import router from './router';

function App() {
  return (
    <RouterProvider
      router={router}
      future={{ v7_startTransition: true }} // <-- Esta línea es importante
    />
  );
}

export default App;