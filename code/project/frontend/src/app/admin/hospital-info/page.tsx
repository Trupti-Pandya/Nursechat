"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, FileUp, TableProperties, Layout } from "lucide-react";

export default function HospitalInfoAdmin() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-6">Hospital Information Management</h1>
      <p className="mb-10 text-gray-600">Manage hospital information documents that the chatbot will use to answer hospital-specific questions.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Traditional File Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileUp className="mr-2 h-5 w-5" />
              Traditional Upload
            </CardTitle>
            <CardDescription>Upload a markdown file directly</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Upload your pre-formatted hospital information markdown file directly to the system.</p>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href="/admin/hospital-info/upload">Upload File</Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Structured Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TableProperties className="mr-2 h-5 w-5" />
              Structured Form
            </CardTitle>
            <CardDescription>Create using a structured form</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Use our structured form to create a well-formatted hospital information document with consistent formatting.</p>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href="/admin/hospital-info/structured-form">Open Form</Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Dashboard UI */}
        <Card className="bg-primary/5 border-primary">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Layout className="mr-2 h-5 w-5" />
              Dashboard UI
            </CardTitle>
            <CardDescription>New split-view dashboard interface</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Try our new dashboard interface with a permanent sidebar navigation and improved workflow.</p>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href="/admin/hospital-info/structured-form/dashboard">Open Dashboard</Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Manage Files */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2 h-5 w-5" />
              Manage Files
            </CardTitle>
            <CardDescription>View and manage existing files</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">View, preview, activate, schedule, and delete hospital information files in the system.</p>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href="/admin/hospital-info/manage">Manage Files</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 