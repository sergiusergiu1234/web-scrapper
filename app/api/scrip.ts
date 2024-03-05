"use server";
import { PrismaClient } from "@prisma/client";
import puppeteer, { ProtocolError } from "puppeteer";

const prisma = new PrismaClient();

export async function scrapeData() {
  let browser;
  try {
    browser = await puppeteer.launch({
      args: ["--no-sandbox"],
      defaultViewport: {
        width: 1400,
        height: 600,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    });
    const page = await browser.newPage();
    await page.goto("https://ecommerceberlin.com/exhibitors");
    await page.waitForSelector(".MuiGrid-root .MuiListItem-container");

    let exhibitorHandles = await page.$$(
      ".MuiGrid-root .MuiListItem-container"
    );
    console.log(exhibitorHandles.length);
    while (exhibitorHandles.length > 0) {
      for (let i = 0; i < exhibitorHandles.length; i++) {
        const percentage = ((i + 1) / exhibitorHandles.length) * 100;

        console.log("Progress: ", percentage.toFixed(2));
        if (percentage === 100) {
          return;
        }
        let exhibitorName = "";
        const exhibitorHandle = exhibitorHandles[i];
        const nameElement = await exhibitorHandle.$(".MuiListItemText-primary");
        exhibitorName += await page.evaluate(
          (element) => element?.textContent,
          nameElement
        );
        console.log("Exhibitor Name:", exhibitorName);
        const existingExhibitor = await prisma.exhibitor.findFirst({
          where: {
            name: exhibitorName,
          },
        });

        if (existingExhibitor) {
          console.log("Exhitibitor aleady exists. ");
        } else {
          // Click on the exhibitor link
          await Promise.all([page.waitForNavigation(), nameElement?.click()]);
          let categories: string[] = [];
          //find categories of the current exhibitor and create them in database if they dont exist
          try {
            page.waitForSelector(".jss141" || ".jss142" || ".jss143");
            try {
              await page.waitForSelector(".MuiGrid-root .MuiListItem-container");
              const gridContainer = await page.$(".MuiGrid-root .MuiGrid-item");
              const categoryElements = await gridContainer?.$$(
                " a.MuiButton-root "
              );

              if (categoryElements) {
                for (const categoryElement of categoryElements) {
                  const text = await page.evaluate(
                    (element) => element.textContent,
                    categoryElement
                  );
                  if (text) {
                    categories.push(text);
                  }
                }
              }

              try {
                await prisma.$transaction(async (prisma) => {
                  for (const category of categories) {
                    const existingCategory = await prisma.category.findFirst({
                      where: {
                        name: category,
                      },
                    });

                    if (!existingCategory) {
                      await prisma.category.create({
                        data: {
                          name: category,
                        },
                      });
                      console.log(`Category ${category} created.`);
                    }
                  }
                });
              } catch (error) {
                console.log("Error creating categories: ", error);
                break;
              }
            } catch (error) {
              console.log("Error extracting categories", error);
            }

            // Get the href attribute
            let linkedInHref = "";
            const linkedInElement = await page.$('a[href*="linkedin.com"]');
            if (linkedInElement) {
              linkedInHref += await page.evaluate(
                (link) => link?.getAttribute("href"),
                linkedInElement
              );
            } else {
              console.log("LinkedIn Profile link not found.");
            }

            // extract the about text and log it in console
            const moreElement = await page.$(".MuiBox-root .jss144");
            moreElement && (await moreElement.click());

            const parentDiv = await page.$(".jss141" || ".jss142");
            // const childParagraphs = await parentDiv?.$$('p' || 'h1' || 'h2');
            let exhibitorAbout = "";

            const text = await page.evaluate(
              (element) => element?.textContent,
              parentDiv
            );
            if (text) exhibitorAbout += removeEmojis(text);

            console.log("Creating new exhibitor...");
            await prisma.$transaction(async (prisma) => {
              const existingExhibitor = await prisma.exhibitor.findFirst({
                where: {
                  name: exhibitorName,
                },
              });

              if (existingExhibitor) {
                console.log(`Exhibitor already exists: ${exhibitorName}`);
              } else {
                // Fetch categories based on their names
                const fetchedCategories = await prisma.category.findMany({
                  where: {
                    name: {
                      in: categories,
                    },
                  },
                  select: {
                    id: true,
                  },
                });

                //create exhibitor
                await prisma.exhibitor.create({
                  data: {
                    name: exhibitorName,
                    linked: linkedInHref || "",
                    about: exhibitorAbout,
                    categories: {
                      connect: fetchedCategories,
                    },
                  },
                });

                console.log("Created exhibitor", exhibitorName);
              }
            });
          } catch (err) {
            console.log("error happened inside page", err);
          }

          // // Go back to the exhibitors page
          await Promise.all([
            page.waitForNavigation(),
            page.goto("https://ecommerceberlin.com/exhibitors"),
          ]);

          //wait until page fully loads
          await page.waitForSelector(".MuiGrid-root .MuiListItem-container");
          // Update the list of exhibitor handles
          exhibitorHandles = await page.$$(
            ".MuiGrid-root .MuiListItem-container"
          );
        }
      }
    }
    console.log("Finished processing all exhibitors");
  } catch (error: any) {
    if (error instanceof ProtocolError) {
      console.log("Protocol Error occured: ", error);
    } else {
      console.error("An error occurred:", error);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
    await prisma.$disconnect();
  }
}

function removeEmojis(text: string) {
  // Regular expression to match emojis
  const emojiPattern =
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

  // Remove emojis using replace method
  return text.replace(emojiPattern, "");
}
