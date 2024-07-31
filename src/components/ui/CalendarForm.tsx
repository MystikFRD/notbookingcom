"use client";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DateRangePicker } from "react-date-range";
import { format } from "date-fns";
import { Button } from "./button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "./form";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { toast } from "./use-toast";
import { useState, useEffect } from "react";
import { CalendarIcon } from "lucide-react";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import "../../styles/DateRangePickerCustom.css"; // Import custom CSS
import pb from "../../lib/pocketbase"; // Import PocketBase client
import { saveBooking } from "../../utils/saveBooking";
import { cn } from "../../lib/utils";

const FormSchema = z.object({
    dateRange: z.object({
        startDate: z.date({
            required_error: "A start date is required.",
        }),
        endDate: z.date({
            required_error: "An end date is required.",
        }),
    }).superRefine((data, ctx) => {
        if (data.endDate <= data.startDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "End date must be after start date",
                path: ["endDate"],
            });
        }
    }),
});

export function CalendarForm({ listingId }: { listingId: number }) {
    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
    });
    const [range, setRange] = useState([{ startDate: new Date(), endDate: new Date(), key: "selection" }]);
    const [isBooked, setIsBooked] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(false);

    useEffect(() => {
        if (bookingSuccess) {
            const timer = setTimeout(() => {
                setBookingSuccess(false);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [bookingSuccess]);

    async function onSubmit(data: z.infer<typeof FormSchema>) {
        const formattedData = {
            startDate: format(data.dateRange.startDate, "yyyy-MM-dd"),
            endDate: format(data.dateRange.endDate, "yyyy-MM-dd"),
            userEmail: sessionStorage.getItem("userEmail") || "unknown",
            listingId: listingId,
        };

        console.log("Submitting booking with data:", formattedData);

        try {
            // Check for overlapping bookings
            const existingBookings = await pb.collection("buchungen").getFullList({
                filter: `listing="${listingId}" && (
                    (startDate <= "${formattedData.startDate}" && endDate >= "${formattedData.startDate}") ||
                    (startDate <= "${formattedData.endDate}" && endDate >= "${formattedData.endDate}") ||
                    (startDate >= "${formattedData.startDate}" && endDate <= "${formattedData.endDate}")
                )`,
            });

            if (existingBookings.length > 0) {
                setIsBooked(true);
                toast({
                    title: "Error",
                    description: "This listing is already booked for the selected dates.",
                    status: "error",
                });
                return;
            } else {
                setIsBooked(false);
            }

            const record = await saveBooking(formattedData);
            console.log("Booking successful:", record);

            setBookingSuccess(true); // Set booking success to true

            toast({
                title: "Booking Successful",
                description: (
                    <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
                        <code className="text-white">{JSON.stringify(record, null, 2)}</code>
                    </pre>
                ),
            });
        } catch (error) {
            console.error("Error during booking submission:", error);
            toast({
                title: "Error",
                description: error.message || "There was an error saving your booking. Please try again.",
                status: "error",
            });
        }
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {bookingSuccess && (
                    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 w-full max-w-md z-50">
                        <Alert>
                            <AlertTitle>Sucess!</AlertTitle>
                            <AlertDescription>
                                Your booking was successful.
                            </AlertDescription>
                        </Alert>
                    </div>
                )}
                <FormField
                    control={form.control}
                    name="dateRange"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Booking Dates</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-[240px] pl-3 text-left font-normal",
                                                !field.value && "text-muted-foreground"
                                            )}
                                        >
                                            {field.value ? (
                                                `${format(range[0].startDate, "PPP")} - ${format(range[0].endDate, "PPP")}`
                                            ) : (
                                                <span>Pick a date range</span>
                                            )}
                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <DateRangePicker
                                        ranges={range}
                                        onChange={(item) => {
                                            setRange([item.selection]);
                                            field.onChange({ startDate: item.selection.startDate, endDate: item.selection.endDate });
                                        }}
                                        disabledDay={(date) => date < new Date()}
                                    />
                                </PopoverContent>
                            </Popover>
                            <FormDescription>
                                Select the start and end dates for your trip.
                            </FormDescription>
                            <FormMessage />
                            {isBooked && (
                                <p className="text-red-500">This listing is already booked for the selected dates.</p>
                            )}
                        </FormItem>
                    )}
                />
                <Button type="submit">Submit</Button>
            </form>
        </Form>
    );
}
