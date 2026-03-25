"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { PlusCircle, Trash2, Save, FileDown, Eye, EyeOff } from "lucide-react";
import dynamic from "next/dynamic";

// Dynamically import ReactMarkdown with no SSR to avoid hydration issues
const ReactMarkdown = dynamic(() => import("react-markdown"), { ssr: false });

export default function StructuredHospitalInfoForm() {
  const { showToast } = useToast();
  // Metadata fields (won't be included in the markdown)
  const [hospitalName, setHospitalName] = useState("General Hospital of Surat");
  const [lastUpdated, setLastUpdated] = useState(new Date().toISOString().split('T')[0]);
  const [updatedBy, setUpdatedBy] = useState("Medical Administration");
  const [notes, setNotes] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  
  // Activation options
  const [activationOption, setActivationOption] = useState("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // Ward information
  const [wards, setWards] = useState([
    { name: "General Medicine", location: "2nd Floor, Block A", head: "Dr. Richard Thompson", dayShift: "Dr. Emily Carter", nightShift: "Dr. Mark Sullivan" }
  ]);

  // Referral Information
  const [referralHospitals, setReferralHospitals] = useState([
    { name: "Surat Royal Infirmary" }, 
    { name: "Nottingham City Hospital" }
  ]);

  // Laboratory information
  const [labs, setLabs] = useState([
    { name: "Pathology Lab", location: "1st Floor, Block A", head: "Dr. Charles Adams", services: "Tissue analysis, biopsies" }
  ]);
  
  // Unavailable laboratories
  const [unavailableLabs, setUnavailableLabs] = useState([
    { name: "Toxicology Lab", description: "for poison and drug overdose cases", referral: "Toxicology Unit at Birmingham Hospital" },
    { name: "Forensic Lab", description: "for crime-related medical investigations", referral: "Forensic Department at Surat Police Medical Centre" }
  ]);

  // Specialist availability - 24/7
  const [alwaysAvailableSpecialists, setAlwaysAvailableSpecialists] = useState([
    { type: "General Physicians", head: "Dr. Emily Carter" },
    { type: "Emergency Surgeons", head: "Dr. Susan Anderson" }
  ]);

  // Specialist availability - Scheduled
  const [scheduledSpecialists, setScheduledSpecialists] = useState([
    { type: "Neurologists", availability: "Monday to Friday", head: "Dr. Daniel Lewis", notes: "Emergency services available 24/7" }
  ]);

  // Emergency procedures
  const [emergencyProcedures, setEmergencyProcedures] = useState([
    { 
      name: "Heart Attacks & Trauma Cases", 
      initialResponse: "Immediate stabilization in Emergency & Trauma Ward", 
      secondaryResponse: "Transfer to specialized units (Cardiology/ICU)",
      contact: "Emergency response team via extension 1111" 
    }
  ]);

  // Pharmacy information
  const [pharmacyLocations, setPharmacyLocations] = useState([
    { name: "Main Pharmacy", location: "Ground Floor, Block A", hours: "Open 24/7", services: "All prescription medications" }
  ]);

  // Referral hospitals
  const [partnerHospitals, setPartnerHospitals] = useState([
    { name: "Surat Royal Infirmary", specialization: "Specialized surgeries and transplant services", contact: "0123-456-7890" }
  ]);

  // Hospital navigation - Access points
  const [accessPoints, setAccessPoints] = useState([
    { name: "Main Entrance", description: "Located on Surat Road, accessible via Gate 1" }
  ]);

  // Hospital navigation - Key locations
  const [keyLocations, setKeyLocations] = useState([
    { name: "Reception & Emergency", description: "Ground Floor, Block C, straight from Main Entrance" }
  ]);

  // FAQ
  const [faq, setFaq] = useState([
    { question: "How do I find a specific department?", answer: "Check the information desk at the main entrance. All departments are color-coded on maps throughout the hospital." }
  ]);

  // Type-safe helper functions for adding/removing items from arrays
  type SetStateFunction<T> = React.Dispatch<React.SetStateAction<T[]>>;

  const addItem = <T,>(
    array: T[], 
    setArray: SetStateFunction<T>, 
    defaultItem: T
  ): void => {
    setArray([...array, defaultItem]);
  };

  const removeItem = <T,>(
    array: T[], 
    setArray: SetStateFunction<T>, 
    index: number
  ): void => {
    const newArray = [...array];
    newArray.splice(index, 1);
    setArray(newArray);
  };

  const updateItem = <T, K extends keyof T>(
    array: T[], 
    setArray: SetStateFunction<T>, 
    index: number, 
    field: K, 
    value: T[K]
  ): void => {
    const newArray = [...array];
    newArray[index] = { ...newArray[index], [field]: value };
    setArray(newArray);
  };

  // Function to generate markdown
  const generateMarkdown = () => {
    let markdown = `# Hospital Name: ${hospitalName} - Facilities Report

> **IMPORTANT**: This document contains essential information about hospital facilities, staff, and procedures for medical personnel. Please refer to this guide when directing patients or seeking resources.

## 1. Ward Information

| Ward Name | Location | Head | Day Shift | Night Shift |
|-----------|----------|------|-----------|-------------|
${wards.map(ward => `| ${ward.name} | ${ward.location} | ${ward.head} | ${ward.dayShift} | ${ward.nightShift} |`).join('\n')}

### Referral Information for Specialized Wards

If a patient requires a specialized ward not available in our hospital, we recommend referral to:
${referralHospitals.map(hospital => `- **${hospital.name}**`).join('\n')}

Both have extensive facilities for specialized care.

---

## 2. Laboratory Facilities

| Lab Name | Location | Head | Services Provided |
|----------|----------|------|------------------|
${labs.map(lab => `| ${lab.name} | ${lab.location} | ${lab.head} | ${lab.services} |`).join('\n')}

### Unavailable Laboratory Services

> **NOTE**: We do **not** currently have the following labs:
${unavailableLabs.map(lab => `> - **${lab.name}** (${lab.description})`).join('\n')}

${unavailableLabs.map(lab => `For ${lab.name.toLowerCase()} cases, collaborate with **${lab.referral}**.`).join('  \n')}

---

## 3. Specialist Availability

### Always Available (24/7)
${alwaysAvailableSpecialists.map(spec => `- **${spec.type}** – Head: ${spec.head}`).join('\n')}

### Weekly Schedule

| Specialist Type | Availability | Head | Notes |
|----------------|--------------|------|-------|
${scheduledSpecialists.map(spec => `| ${spec.type} | ${spec.availability} | ${spec.head} | ${spec.notes} |`).join('\n')}

---

## 4. Emergency Procedures

### Priority Cases
${emergencyProcedures.map((proc, index) => `${index + 1}. **${proc.name}**
   - **Initial Response**: ${proc.initialResponse}
   - **Secondary Response**: ${proc.secondaryResponse}
   - **Contact**: ${proc.contact}`).join('\n\n')}

---

## 5. Pharmacy & Medication Services

### Locations and Hours
${pharmacyLocations.map(pharm => `- **${pharm.name}** – ${pharm.location}
  - **Hours**: ${pharm.hours}
  - **Services**: ${pharm.services}`).join('\n\n')}

---

## 6. Referral and Partner Hospitals

### Specialized Services Partners

| Hospital | Specialization | Referral Contact |
|----------|----------------|------------------|
${partnerHospitals.map(hosp => `| ${hosp.name} | ${hosp.specialization} | ${hosp.contact} |`).join('\n')}

### Referral Protocol
1. Contact referral hospital to confirm availability
2. Complete referral form (available on hospital intranet)
3. Arrange transportation if urgent
4. Transfer patient records electronically

---

## 7. Hospital Navigation

### Main Access Points
${accessPoints.map(point => `- **${point.name}**: ${point.description}`).join('\n')}

### Key Locations
${keyLocations.map(loc => `- **${loc.name}**: ${loc.description}`).join('\n')}

### Wayfinding
- Follow color-coded paths on floors:
  - Red: Emergency routes
  - Blue: Outpatient services
  - Green: Inpatient wards
  - Yellow: Administrative areas

---

## FAQ

### Patient Frequently Asked Questions

${faq.map(item => `**Q: ${item.question}**  
A: ${item.answer}`).join('\n\n')}

---

*Our hospital ensures that every patient gets the best possible care, whether within our hospital or through our trusted medical partners.*

*For any updates to this information, please contact Medical Administration at ext. 5555.*`;

    return markdown;
  };

  // Submit function
  const handleSubmit = async () => {
    try {
      // Basic validations
      if (!hospitalName.trim()) {
        showToast("Hospital name cannot be empty", "error");
        return;
      }
      
      if (wards.length === 0) {
        showToast("Please add at least one ward", "error");
        return;
      }
      
      // Validate that date and time are provided if scheduling for later
      if (activationOption === "later" && (!scheduledDate || !scheduledTime)) {
        showToast("Please select both date and time for scheduled activation", "error");
        return;
      }
      
      const markdown = generateMarkdown();
      
      // Calculate scheduled activation time if needed
      let scheduledActivationTime = null;
      if (activationOption === "later" && scheduledDate && scheduledTime) {
        // Make sure the date is in the future
        const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
        if (scheduledDateTime <= new Date()) {
          showToast("Scheduled time must be in the future", "error");
          return;
        }
        scheduledActivationTime = scheduledDateTime.toISOString();
      }
      
      // Create metadata in separate notes field
      const metadataObj = {
        version: "1.0",
        last_updated: lastUpdated,
        updated_by: updatedBy,
        hospital_name: hospitalName,
        additional_notes: notes
      };
      
      const response = await fetch('/api/admin/hospital-info/save-structured', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: markdown,
          filename: `${hospitalName.replace(/\s+/g, '-').toLowerCase()}-info.md`,
          version: 1, // Use integer instead of string
          isActive: activationOption === "now",
          scheduledActivationTime: scheduledActivationTime,
          notes: JSON.stringify(metadataObj)
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Failed to save hospital information');
      }

      showToast("Hospital information saved successfully", "success");
    } catch (error: unknown) {
      console.error('Error saving hospital information:', error);
      showToast(error instanceof Error ? error.message : "Failed to save hospital information", "error");
    }
  };

  // Download markdown function
  const downloadMarkdown = () => {
    const markdown = generateMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${hospitalName.replace(/\s+/g, '-').toLowerCase()}-info.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Structured Hospital Information Form</h1>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? <><EyeOff className="mr-2 h-4 w-4" /> Hide Preview</> : <><Eye className="mr-2 h-4 w-4" /> Show Preview</>}
          </Button>
          <Button variant="outline" onClick={downloadMarkdown}>
            <FileDown className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button onClick={handleSubmit}>
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={showPreview ? "col-span-1" : "col-span-2"}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
              <CardDescription>Basic details about the document (stored in notes field)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Hospital Name</label>
                <Input 
                  value={hospitalName} 
                  onChange={(e) => setHospitalName(e.target.value)} 
                  placeholder="Enter hospital name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Last Updated</label>
                  <Input 
                    type="date"
                    value={lastUpdated} 
                    onChange={(e) => setLastUpdated(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Updated By</label>
                  <Input 
                    value={updatedBy} 
                    onChange={(e) => setUpdatedBy(e.target.value)} 
                    placeholder="Department or person name"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Additional Notes</label>
                <Textarea 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  placeholder="Any additional notes about this document"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
          
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Activation Settings</CardTitle>
              <CardDescription>When should this information become active</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={activationOption} onValueChange={setActivationOption}>
                <div className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value="now" id="now" />
                  <Label htmlFor="now">Activate immediately</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="later" id="later" />
                  <Label htmlFor="later">Schedule activation for later</Label>
                </div>
              </RadioGroup>
              
              {activationOption === "later" && (
                <div className="grid grid-cols-2 gap-4 mt-4 pl-6">
                  <div>
                    <label className="block text-sm font-medium mb-1">Date</label>
                    <Input 
                      type="date"
                      value={scheduledDate} 
                      onChange={(e) => setScheduledDate(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Time</label>
                    <Input 
                      type="time"
                      value={scheduledTime} 
                      onChange={(e) => setScheduledTime(e.target.value)} 
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Tabs defaultValue="wards">
            <TabsList className="mb-4 flex flex-wrap">
              <TabsTrigger value="wards">Wards</TabsTrigger>
              <TabsTrigger value="labs">Labs</TabsTrigger>
              <TabsTrigger value="specialists">Specialists</TabsTrigger>
              <TabsTrigger value="emergency">Emergency</TabsTrigger>
              <TabsTrigger value="pharmacy">Pharmacy</TabsTrigger>
              <TabsTrigger value="referrals">Referrals</TabsTrigger>
              <TabsTrigger value="navigation">Navigation</TabsTrigger>
              <TabsTrigger value="faq">FAQ</TabsTrigger>
            </TabsList>

            {/* Wards Tab */}
            <TabsContent value="wards">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Ward Information</CardTitle>
                  <CardDescription>Information about hospital wards and their staff</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addItem(wards, setWards, { 
                          name: "", 
                          location: "", 
                          head: "", 
                          dayShift: "", 
                          nightShift: "" 
                        })}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Ward
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ward Name</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Head</TableHead>
                          <TableHead>Day Shift</TableHead>
                          <TableHead>Night Shift</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {wards.map((ward, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Input 
                                value={ward.name} 
                                onChange={(e) => updateItem(wards, setWards, index, 'name', e.target.value)} 
                                placeholder="Ward name"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={ward.location} 
                                onChange={(e) => updateItem(wards, setWards, index, 'location', e.target.value)} 
                                placeholder="Location"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={ward.head} 
                                onChange={(e) => updateItem(wards, setWards, index, 'head', e.target.value)} 
                                placeholder="Head doctor"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={ward.dayShift} 
                                onChange={(e) => updateItem(wards, setWards, index, 'dayShift', e.target.value)} 
                                placeholder="Day shift"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={ward.nightShift} 
                                onChange={(e) => updateItem(wards, setWards, index, 'nightShift', e.target.value)} 
                                placeholder="Night shift"
                              />
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => removeItem(wards, setWards, index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Referral Information for Specialized Wards</CardTitle>
                  <CardDescription>For specialized wards not available in our hospital</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addItem(referralHospitals, setReferralHospitals, { name: "" })}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Referral Hospital
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Hospital Name</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {referralHospitals.map((hospital, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Input 
                                value={hospital.name} 
                                onChange={(e) => updateItem(referralHospitals, setReferralHospitals, index, 'name', e.target.value)} 
                                placeholder="Hospital name"
                              />
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => removeItem(referralHospitals, setReferralHospitals, index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Labs Tab */}
            <TabsContent value="labs">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Laboratory Facilities</CardTitle>
                  <CardDescription>Information about laboratory facilities and services</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addItem(labs, setLabs, { 
                          name: "", 
                          location: "", 
                          head: "", 
                          services: "" 
                        })}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Lab
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lab Name</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Head</TableHead>
                          <TableHead>Services</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {labs.map((lab, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Input 
                                value={lab.name} 
                                onChange={(e) => updateItem(labs, setLabs, index, 'name', e.target.value)} 
                                placeholder="Lab name"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={lab.location} 
                                onChange={(e) => updateItem(labs, setLabs, index, 'location', e.target.value)} 
                                placeholder="Location"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={lab.head} 
                                onChange={(e) => updateItem(labs, setLabs, index, 'head', e.target.value)} 
                                placeholder="Head doctor"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={lab.services} 
                                onChange={(e) => updateItem(labs, setLabs, index, 'services', e.target.value)} 
                                placeholder="Services provided"
                              />
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => removeItem(labs, setLabs, index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Unavailable Laboratory Services</CardTitle>
                  <CardDescription>Labs we don't have and where to refer patients</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addItem(unavailableLabs, setUnavailableLabs, { 
                          name: "", 
                          description: "", 
                          referral: ""
                        })}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Unavailable Lab
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lab Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Referral To</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unavailableLabs.map((lab, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Input 
                                value={lab.name} 
                                onChange={(e) => updateItem(unavailableLabs, setUnavailableLabs, index, 'name', e.target.value)} 
                                placeholder="Lab name"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={lab.description} 
                                onChange={(e) => updateItem(unavailableLabs, setUnavailableLabs, index, 'description', e.target.value)} 
                                placeholder="Description"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={lab.referral} 
                                onChange={(e) => updateItem(unavailableLabs, setUnavailableLabs, index, 'referral', e.target.value)} 
                                placeholder="Referral location"
                              />
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => removeItem(unavailableLabs, setUnavailableLabs, index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Specialists Tab */}
            <TabsContent value="specialists">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Always Available Specialists (24/7)</CardTitle>
                  <CardDescription>Specialists that are available at all times</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addItem(alwaysAvailableSpecialists, setAlwaysAvailableSpecialists, { 
                          type: "", 
                          head: "" 
                        })}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Specialist Type
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Specialist Type</TableHead>
                          <TableHead>Head</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {alwaysAvailableSpecialists.map((specialist, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Input 
                                value={specialist.type} 
                                onChange={(e) => updateItem(alwaysAvailableSpecialists, setAlwaysAvailableSpecialists, index, 'type', e.target.value)} 
                                placeholder="Type of specialist"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={specialist.head} 
                                onChange={(e) => updateItem(alwaysAvailableSpecialists, setAlwaysAvailableSpecialists, index, 'head', e.target.value)} 
                                placeholder="Head doctor"
                              />
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => removeItem(alwaysAvailableSpecialists, setAlwaysAvailableSpecialists, index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Scheduled Specialists</CardTitle>
                  <CardDescription>Specialists available on a scheduled basis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addItem(scheduledSpecialists, setScheduledSpecialists, { 
                          type: "", 
                          availability: "", 
                          head: "", 
                          notes: "" 
                        })}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Scheduled Specialist
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Specialist Type</TableHead>
                          <TableHead>Availability</TableHead>
                          <TableHead>Head</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scheduledSpecialists.map((specialist, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Input 
                                value={specialist.type} 
                                onChange={(e) => updateItem(scheduledSpecialists, setScheduledSpecialists, index, 'type', e.target.value)} 
                                placeholder="Type of specialist"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={specialist.availability} 
                                onChange={(e) => updateItem(scheduledSpecialists, setScheduledSpecialists, index, 'availability', e.target.value)} 
                                placeholder="e.g., Monday to Friday"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={specialist.head} 
                                onChange={(e) => updateItem(scheduledSpecialists, setScheduledSpecialists, index, 'head', e.target.value)} 
                                placeholder="Head doctor"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={specialist.notes} 
                                onChange={(e) => updateItem(scheduledSpecialists, setScheduledSpecialists, index, 'notes', e.target.value)} 
                                placeholder="Additional notes"
                              />
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => removeItem(scheduledSpecialists, setScheduledSpecialists, index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Emergency Tab */}
            <TabsContent value="emergency">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Emergency Procedures</CardTitle>
                  <CardDescription>Information about emergency procedures and response</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addItem(emergencyProcedures, setEmergencyProcedures, { 
                          name: "", 
                          initialResponse: "", 
                          secondaryResponse: "", 
                          contact: "" 
                        })}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Emergency Procedure
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Procedure Name</TableHead>
                          <TableHead>Initial Response</TableHead>
                          <TableHead>Secondary Response</TableHead>
                          <TableHead>Contact</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {emergencyProcedures.map((procedure, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Input 
                                value={procedure.name} 
                                onChange={(e) => updateItem(emergencyProcedures, setEmergencyProcedures, index, 'name', e.target.value)} 
                                placeholder="Procedure name"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={procedure.initialResponse} 
                                onChange={(e) => updateItem(emergencyProcedures, setEmergencyProcedures, index, 'initialResponse', e.target.value)} 
                                placeholder="Initial response"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={procedure.secondaryResponse} 
                                onChange={(e) => updateItem(emergencyProcedures, setEmergencyProcedures, index, 'secondaryResponse', e.target.value)} 
                                placeholder="Secondary response"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={procedure.contact} 
                                onChange={(e) => updateItem(emergencyProcedures, setEmergencyProcedures, index, 'contact', e.target.value)} 
                                placeholder="Contact information"
                              />
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => removeItem(emergencyProcedures, setEmergencyProcedures, index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pharmacy Tab */}
            <TabsContent value="pharmacy">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Pharmacy Locations and Services</CardTitle>
                  <CardDescription>Information about hospital pharmacies and their services</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addItem(pharmacyLocations, setPharmacyLocations, { 
                          name: "", 
                          location: "", 
                          hours: "", 
                          services: "" 
                        })}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Pharmacy
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pharmacy Name</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Services</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pharmacyLocations.map((pharmacy, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Input 
                                value={pharmacy.name} 
                                onChange={(e) => updateItem(pharmacyLocations, setPharmacyLocations, index, 'name', e.target.value)} 
                                placeholder="Pharmacy name"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={pharmacy.location} 
                                onChange={(e) => updateItem(pharmacyLocations, setPharmacyLocations, index, 'location', e.target.value)} 
                                placeholder="Location"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={pharmacy.hours} 
                                onChange={(e) => updateItem(pharmacyLocations, setPharmacyLocations, index, 'hours', e.target.value)} 
                                placeholder="Hours"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={pharmacy.services} 
                                onChange={(e) => updateItem(pharmacyLocations, setPharmacyLocations, index, 'services', e.target.value)} 
                                placeholder="Services provided"
                              />
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => removeItem(pharmacyLocations, setPharmacyLocations, index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Referrals Tab */}
            <TabsContent value="referrals">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Referral Hospitals</CardTitle>
                  <CardDescription>Information about referral hospitals and their services</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addItem(partnerHospitals, setPartnerHospitals, { 
                          name: "", 
                          specialization: "", 
                          contact: "" 
                        })}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Referral Hospital
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Hospital Name</TableHead>
                          <TableHead>Specialization</TableHead>
                          <TableHead>Referral Contact</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {partnerHospitals.map((hospital, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Input 
                                value={hospital.name} 
                                onChange={(e) => updateItem(partnerHospitals, setPartnerHospitals, index, 'name', e.target.value)} 
                                placeholder="Hospital name"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={hospital.specialization} 
                                onChange={(e) => updateItem(partnerHospitals, setPartnerHospitals, index, 'specialization', e.target.value)} 
                                placeholder="Specialization"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={hospital.contact} 
                                onChange={(e) => updateItem(partnerHospitals, setPartnerHospitals, index, 'contact', e.target.value)} 
                                placeholder="Referral contact"
                              />
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => removeItem(partnerHospitals, setPartnerHospitals, index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Navigation Tab */}
            <TabsContent value="navigation">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Hospital Navigation</CardTitle>
                  <CardDescription>Information about hospital access points and key locations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addItem(accessPoints, setAccessPoints, { 
                          name: "", 
                          description: "" 
                        })}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Access Point
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Access Point</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accessPoints.map((point, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Input 
                                value={point.name} 
                                onChange={(e) => updateItem(accessPoints, setAccessPoints, index, 'name', e.target.value)} 
                                placeholder="Access point name"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={point.description} 
                                onChange={(e) => updateItem(accessPoints, setAccessPoints, index, 'description', e.target.value)} 
                                placeholder="Description"
                              />
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => removeItem(accessPoints, setAccessPoints, index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Key Locations</CardTitle>
                  <CardDescription>Information about key locations within the hospital</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addItem(keyLocations, setKeyLocations, { 
                          name: "", 
                          description: "" 
                        })}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Key Location
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Location Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {keyLocations.map((location, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Input 
                                value={location.name} 
                                onChange={(e) => updateItem(keyLocations, setKeyLocations, index, 'name', e.target.value)} 
                                placeholder="Location name"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={location.description} 
                                onChange={(e) => updateItem(keyLocations, setKeyLocations, index, 'description', e.target.value)} 
                                placeholder="Description"
                              />
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => removeItem(keyLocations, setKeyLocations, index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* FAQ Tab */}
            <TabsContent value="faq">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>FAQ</CardTitle>
                  <CardDescription>Frequently asked questions about the hospital</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addItem(faq, setFaq, { 
                          question: "", 
                          answer: "" 
                        })}
                      >
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add FAQ Question
                      </Button>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Question</TableHead>
                          <TableHead>Answer</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {faq.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Input 
                                value={item.question} 
                                onChange={(e) => updateItem(faq, setFaq, index, 'question', e.target.value)} 
                                placeholder="Question"
                              />
                            </TableCell>
                            <TableCell>
                              <Input 
                                value={item.answer} 
                                onChange={(e) => updateItem(faq, setFaq, index, 'answer', e.target.value)} 
                                placeholder="Answer"
                              />
                            </TableCell>
                            <TableCell>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => removeItem(faq, setFaq, index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {showPreview && (
          <div className="col-span-1">
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle>Markdown Preview</CardTitle>
                <CardDescription>Preview of the generated markdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-md p-4 mb-4 text-xs font-mono bg-gray-50 overflow-auto max-h-[300px] whitespace-pre-wrap">
                  {generateMarkdown()}
                </div>
                
                <h3 className="font-semibold mb-2">Rendered Preview</h3>
                <div className="border rounded-md p-4 overflow-auto max-h-[400px] prose prose-sm">
                  <ReactMarkdown>{generateMarkdown()}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
} 