# school bus tracking app

this app helps various employees at a school know when busses have arrived for dismissal. teachers need to know when to send their kids out to get on busses, and administrators need to keep track of bus performance. bus monitors help track arrival and departure times and need to notify teachers when a different bus is covering a route for the day. adminstrators are informed at different times when a bus is "uncovered" (no-show) for the day.

bus monitors are outside on mobile devices, often in the cold of winter, so an easy mobile-friendly layout is paramount. being able to revert a change if they make a mistake while wrangling unruly kids is an important feature.

a non-functional goal is to make this incredibly inexpensive to operate. we'll piggy-back off the school's existing google accounts and features to provide authentication, authorization, and data storage. the app itself should be a single-page application that can be hosted for pennies (or free) on any service that provides static file hosting.

security is a consideration, but the data includes only basic bus identifiers, timestamps, and statuses, so it's not critical that to be totally secure.

## user stories

- as an administrator, i can set up a bus tracker for my school and share it via a URL to other employees at my school
- as an administrator, i can set up the expected bus numbers in advance
- as an administrator, i can set expected arrival times for all busses
- as an administrator, i can change the expected arrival times on early dismissal days (five times a school year)
- as a teacher, i can see which busses are pending arrival, are currently here, and have departed for the day
- as a bus monitor, i can see all the busses by bus number in a single screen
- as a bus monitor, i can mark a bus as arrived and record the time
- as a bus monitor, i can mark a bus as departed and record the time
- as a bus monitor, i can mark a bus a "covered" by a separate bus number
- as a adminstrator, i can mark a bus as "uncovered"
- as an adminstrator, i can see statistics about uncovered busses and average & max arrival delays
- as a user, i can log into the app using my school google account
- as a user, i can bookmark the bus app URL for my specific school
