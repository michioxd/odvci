import Head from 'next/head'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'

// import siteConfig from '../../config/site.config'
// import Navbar from '../components/Navbar'
// import FileListing from '../components/FileListing'
// import Footer from '../components/Footer'
// import Breadcrumb from '../components/Breadcrumb'
// import SwitchLayout from '../components/SwitchLayout'

export default function Home() {
  return (
    <></>
  )
}

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
    },
  }
}
