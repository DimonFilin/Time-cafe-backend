import type { NextPage } from 'next';
import Head from 'next/head';

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>Time Cafe - Admin Panel</title>
        <meta name="description" content="Time Cafe Management System" />
      </Head>
      <main>
        <h1>Time Cafe - Shared Service</h1>
        <p>Admin panel for system administrators and brand admins</p>
      </main>
    </>
  );
};

export default Home;
