import React, { useEffect, useState } from "react"
import Modal, { ModalAction } from "../Modal"
import MUITextField from "../../utility/MUITextField/MUITextField"
import MUIAutocomplete from "../../utility/MUIAutocomplete/MUIAutocomplete"
import Toggle from "../../utility/Toggle/Toggle"
import Button from "../../ui/Button/Button"
import ConfirmButton from "../../ui/ConfirmButton/ConfirmButton"
import { CircleCheck, CircleX, FlaskConical, Trash2 } from "lucide-react"
import "./_import_list_modal.scss"

// The form state for an import list modal
export type ImportListFormState = {
  name: string
  url: string
  enabled: boolean
  searchOnAdd: boolean
  qualityProfileId: number
  rootFolderPath: string
}

// Logo URLs for each API
const apiLogos: Record<string, string> = {
  Radarr: "https://radarr.video/img/logo.png",
  Sonarr: "https://sonarr.tv/img/logo.png",
}

interface ImportListModalProps {
  open: boolean
  onClose: () => void
  mode: "edit" | "add"
  apiName: string
  form: ImportListFormState
  onFormChange: (field: keyof ImportListFormState, value: ImportListFormState[keyof ImportListFormState]) => void
  onSave: () => void
  onDelete?: () => void
  onTest?: () => Promise<boolean>
  actionLoading: boolean
  qualityProfileOptions: string[]
  qualityProfileValue: string
  rootFolderOptions: string[]
  qpLoading: boolean
  onQualityProfileChange: (val: string) => void
}

// Modal content for creating or editing an import list
const ImportListModal: React.FC<ImportListModalProps> = ({
  open,
  onClose,
  mode,
  apiName,
  form,
  onFormChange,
  onSave,
  onDelete,
  onTest,
  actionLoading,
  qualityProfileOptions,
  qualityProfileValue,
  rootFolderOptions,
  qpLoading,
  onQualityProfileChange,
}) => {
  const isEdit = mode === "edit"
  const title = isEdit ? "Edit import list" : "New import list"
  const isRadarr = apiName === "Radarr"

  // Test button state. The result stays visible until the URL changes
  const [testState, setTestState] = useState<"idle" | "loading" | "pass" | "fail">("idle")

  // Reset test state when modal opens or URL changes
  useEffect(() => {
    setTestState("idle")
  }, [open, form.url])

  // Handle test button click
  const handleTest = async () => {
    if (!onTest || testState === "loading") return
    setTestState("loading")
    const success = await onTest()
    setTestState(success ? "pass" : "fail")
  }

  // Save/Add button (right-aligned, primary)
  const actions: ModalAction[] = [{
    label: isEdit ? "Save list" : "Add list",
    onClick: onSave,
    variant: "contained",
    disabled: actionLoading,
    loading: actionLoading,
    align: "right",
  }]

  // Delete asks first: removing a list can make its titles eligible for Library Cleanup
  const deleteButton = isEdit && onDelete ? (
    <ConfirmButton
      label="Delete"
      confirmLabel="Delete list"
      question={`Delete ${form.name || "this list"}? Titles that only this list protects can then be removed by Library Cleanup.`}
      icon={<Trash2 aria-hidden="true" />}
      loading={actionLoading}
      disabled={actionLoading}
      onConfirm={onDelete}
    />
  ) : undefined

  // Test button rendered as custom right action (left of Save)
  const testButton = onTest ? (
    <Button
      variant="secondary"
      onClick={handleTest}
      loading={testState === "loading"}
      disabled={!form.url || testState === "loading" || actionLoading}
      icon={<FlaskConical aria-hidden="true" />}
    >
      Test
    </Button>
  ) : undefined

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      icon={apiLogos[apiName]}
      actions={actions}
      customLeftActions={deleteButton}
      customRightActions={testButton}
    >
      <div className="import-list-field-group">
        <Toggle
          name="Enabled"
          checked={form.enabled}
          onToggle={(value: boolean) => onFormChange("enabled", value)}
        />
        <p className="import-list-description">
          Enable this import list in {apiName}. Disabling stops new content being added but existing content remains protected.
        </p>
      </div>
      <MUITextField
        name="modal-name"
        label="Name"
        formErr={{}}
        value={form.name}
        onChange={(e) => onFormChange("name", e.target.value)}
      />
      <MUITextField
        name="modal-url"
        label="List URL"
        formErr={{}}
        value={form.url}
        onChange={(e) => onFormChange("url", e.target.value)}
      />
      <p className={`import-list-test-result test-${testState}`} aria-live="polite">
        {testState === "pass" && <><CircleCheck aria-hidden="true" /> The list URL works.</>}
        {testState === "fail" && <><CircleX aria-hidden="true" /> {apiName} couldn't read this list. Check the URL.</>}
      </p>
      <MUIAutocomplete
        label="Quality Profile"
        options={qualityProfileOptions}
        value={qualityProfileValue}
        loading={qpLoading}
        disabled={qpLoading}
        setValue={(val) => {
          if (val) onQualityProfileChange(val)
        }}
      />
      <MUIAutocomplete
        label="Root Folder"
        options={rootFolderOptions}
        value={form.rootFolderPath}
        setValue={(val) => {
          if (val) onFormChange("rootFolderPath", val)
        }}
      />
      <div className="import-list-field-group">
        <Toggle
          name="Search on Add"
          checked={form.searchOnAdd}
          onToggle={(value: boolean) => onFormChange("searchOnAdd", value)}
        />
        <p className="import-list-description">
          {isRadarr
            ? "Immediately search for and download movies when added from this list."
            : "Immediately search for and download missing episodes when a series is added from this list."
          }
        </p>
      </div>
    </Modal>
  )
}

export default ImportListModal
