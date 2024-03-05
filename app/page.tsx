'use client'

import { useState } from 'react';
import { scrapeData } from './api/scrip';

 
export default function Page() {

  const [scraping,setScraping] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);


  const startScraping = async ()=>{
      setScraping(true);
      await scrapeData();
      setScraping(false);

  }

 

  return (
    <div className='flex flex-col items-center'>
     
        <button onClick={startScraping} disabled ={scraping} className='bg-white text-black p-4' >{scraping ? 'Scraping in progress...' : 'Start scraping'}</button>
       
  
    </div>
  )
  }