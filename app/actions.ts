import { PrismaClient } from '@prisma/client'
import { NextResponse } from "next/server"
import puppeteer from 'puppeteer';
import * as cheerio from "cheerio"



const prisma = new PrismaClient()
export default async function scrape(){

    let browser;


    try{
        browser = await puppeteer.launch({});
        const page = await browser.newPage();
        await page.goto('https://ecommerceberlin.com/exhibitors');
        
        const html = await page.content();
        const $ = cheerio.load(html);

        const categories = $('.jss189 .MuiButton-label').map((index,element)=>{
            return $(element).text();
        }).get();
    
        console.log({categories})
    }catch(error){
        console.log(error);
    }


}
